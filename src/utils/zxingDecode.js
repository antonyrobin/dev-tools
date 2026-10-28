// ZXing decoding on raw luminance data, so it can run in a worker (no DOM needed).
import {
  BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, QRCodeReader, RGBLuminanceSource,
} from '@zxing/library';

const OTHER_FORMATS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.CODABAR, BarcodeFormat.ITF, BarcodeFormat.RSS_14,
  BarcodeFormat.RSS_EXPANDED, BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC, BarcodeFormat.PDF_417,
];

const qrReader = new QRCodeReader();
const makeReader = (tryHarder) => {
  const reader = new MultiFormatReader();
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, OTHER_FORMATS]]);
  if (tryHarder) hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader;
};
const otherReader = makeReader(false);
const thoroughReader = makeReader(true);

/** RGBA pixels → one luminance byte per pixel. */
export function toLuminance(rgba, width, height) {
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    // Transparent pixels count as white (PNG codes are often drawn on transparency)
    const a = rgba[p + 3] / 255;
    lum[i] = ((rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114) * a + 255 * (1 - a)) | 0;
  }
  return lum;
}

const invert = (lum) => lum.map((v) => 255 - v);

function tryReader(reader, lum, width, height) {
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height)));
    return reader === qrReader ? reader.decode(bitmap) : reader.decodeWithState(bitmap);
  } catch {
    return null;
  } finally {
    reader.reset();
  }
}

/** Cheapest decoders first; the slow "try harder" pass only when `thorough`. */
function decodeOne(lum, width, height, { thorough, qrOnly }) {
  const inverted = invert(lum);
  const attempts = qrOnly
    ? [[qrReader, lum], [qrReader, inverted]]
    : [[qrReader, lum], [otherReader, lum], [qrReader, inverted], [otherReader, inverted], ...(thorough ? [[thoroughReader, lum]] : [])];
  for (const [reader, data] of attempts) {
    const result = tryReader(reader, data, width, height);
    if (result) return result;
  }
  return null;
}

/** Blanks the area a code was found in so the next pass can find another one. */
function blank(lum, width, height, points) {
  const xs = points.map((p) => p.getX());
  const ys = points.map((p) => p.getY());
  const pad = Math.max(12, (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) * 0.15);
  const linear = points.length === 2; // 1D barcodes only report a scan line
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const x1 = Math.min(width, Math.ceil(Math.max(...xs) + pad));
  const y0 = linear ? 0 : Math.max(0, Math.floor(Math.min(...ys) - pad));
  const y1 = linear ? height : Math.min(height, Math.ceil(Math.max(...ys) + pad));
  for (let y = y0; y < y1; y++) lum.fill(255, y * width + x0, y * width + x1);
}

function scanLuminance(lum, width, height, opts) {
  const out = [];
  for (let i = 0; i < opts.max; i++) {
    const result = decodeOne(lum, width, height, opts);
    if (!result) break;
    out.push({ text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()], engine: 'zxing' });
    const points = result.getResultPoints() || [];
    if (points.length < 2 || opts.max === 1) break;
    blank(lum, width, height, points);
  }
  return out;
}

function crop(lum, width, x, y, w, h) {
  const out = new Uint8ClampedArray(w * h);
  for (let row = 0; row < h; row++) out.set(lum.subarray((y + row) * width + x, (y + row) * width + x + w), row * w);
  return out;
}

const TILES = [
  [0, 0, 0.6, 1], [0.4, 0, 0.6, 1], [0, 0, 1, 0.6], [0, 0.4, 1, 0.6],
  [0, 0, 0.6, 0.6], [0.4, 0, 0.6, 0.6], [0, 0.4, 0.6, 0.6], [0.4, 0.4, 0.6, 0.6],
];

/**
 * Decodes codes from luminance data.
 * frame: a single fast pass (camera); otherwise a thorough multi-code scan of a still image,
 * retrying overlapping tiles for QR codes (several side by side confuse the QR detector).
 */
export function decodeLuminance(lum, width, height, { frame = false } = {}) {
  if (frame) return scanLuminance(lum, width, height, { max: 1, thorough: false });
  const found = scanLuminance(lum.slice(), width, height, { max: 6, thorough: true });
  if (found.length) return found;
  for (const [x, y, rw, rh] of TILES) {
    const tx = Math.round(width * x);
    const ty = Math.round(height * y);
    const tw = Math.round(width * rw);
    const th = Math.round(height * rh);
    found.push(...scanLuminance(crop(lum, width, tx, ty, tw, th), tw, th, { max: 3, qrOnly: true }));
  }
  return found;
}
