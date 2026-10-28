// QR code & barcode decoding for images and camera frames.
// Uses the browser's native BarcodeDetector when present (Chrome, Edge, Android) and falls
// back to ZXing (pure JS, loaded on demand) everywhere else or when native finds nothing.

const FORMAT_LABELS = {
  qr_code: 'QR Code', micro_qr_code: 'Micro QR', aztec: 'Aztec', data_matrix: 'Data Matrix', pdf417: 'PDF417',
  code_128: 'Code 128', code_39: 'Code 39', code_93: 'Code 93', codabar: 'Codabar', itf: 'ITF',
  ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', rss_14: 'GS1 DataBar', rss_expanded: 'GS1 DataBar Expanded',
  maxicode: 'MaxiCode',
};

/** "QR_CODE" / "qr_code" → "QR Code" */
export const formatLabel = (format) => FORMAT_LABELS[String(format).toLowerCase()] || String(format).replace(/_/g, ' ');

// ===== Native =====

let nativePromise;
function getNativeDetector() {
  if (!nativePromise) {
    nativePromise = (async () => {
      if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        return formats.length ? new window.BarcodeDetector({ formats }) : null;
      } catch {
        return null;
      }
    })();
  }
  return nativePromise;
}

export const hasNativeDetector = async () => Boolean(await getNativeDetector());

async function detectNative(source) {
  const detector = await getNativeDetector();
  if (!detector) return null;
  try {
    const found = await detector.detect(source);
    return found.map((c) => ({ text: c.rawValue, format: formatLabel(c.format), engine: 'native' }));
  } catch {
    return null;
  }
}

// ===== ZXing (in a worker) =====

const MAX_IMAGE_SIDE = 1600;
const MAX_FRAME_SIDE = 960;

/** Draws any image-like source onto a (downscaled) canvas and returns its pixels. */
function readPixels(source, maxSide, canvas = document.createElement('canvas')) {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

let worker = null;
let seq = 0;

function getWorker() {
  if (worker === null && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./scanner.worker.js', import.meta.url), { type: 'module' });
    } catch {
      worker = false;
    }
  }
  return worker || null;
}

async function decodePixels(image, frame) {
  const w = getWorker();
  if (!w) {
    // No workers: decode on the main thread
    const { decodeLuminance, toLuminance } = await import('./zxingDecode');
    return decodeLuminance(toLuminance(image.data, image.width, image.height), image.width, image.height, { frame });
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMessage = (e) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMessage);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.codes);
    };
    w.addEventListener('message', onMessage);
    const pixels = image.data;
    w.postMessage({ id, pixels, width: image.width, height: image.height, frame }, [pixels.buffer]);
  });
}

async function detectZxing(source, { frame = false, canvas } = {}) {
  const image = readPixels(source, frame ? MAX_FRAME_SIDE : MAX_IMAGE_SIDE, canvas);
  const codes = await decodePixels(image, frame);
  return codes.map((c) => ({ ...c, format: formatLabel(c.format) }));
}

// ===== Public API =====

const dedupe = (codes) => {
  const seen = new Set();
  return codes.filter((c) => {
    const key = `${c.format}|${c.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Every code found in a still image (File/Blob or image element). */
export async function scanImage(input) {
  const source = input instanceof Blob ? await createImageBitmap(input) : input;
  try {
    const native = await detectNative(source);
    if (native?.length) return dedupe(native);
    return dedupe(await detectZxing(source));
  } finally {
    if (input instanceof Blob) source.close?.();
  }
}

/** Fast single pass over a live video frame. */
export async function scanFrame(video, canvas) {
  const native = await detectNative(video);
  if (native) return native;
  return detectZxing(video, { frame: true, canvas });
}

/** Starts the decoder early so the first camera frames aren't slowed by loading it. */
export const preloadScanner = async () => {
  if (!(await getNativeDetector())) getWorker();
};

// ===== Content types =====

const parseFields = (body) => {
  const fields = {};
  body.replace(/([A-Z]+):((?:\\.|[^;])*);?/g, (_, k, v) => { fields[k] = v.replace(/\\([\\;,:"])/g, '$1'); return ''; });
  return fields;
};

/** Recognises common QR payloads so the UI can label them and offer the right action. */
export function describeContent(text) {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return { type: 'URL', href: t };
  if (/^www\.\S+\.\S+$/i.test(t)) return { type: 'URL', href: `https://${t}` };
  if (/^WIFI:/i.test(t)) {
    const f = parseFields(t.slice(5));
    return {
      type: 'Wi-Fi',
      details: [['Network', f.S], ['Security', f.T || 'None'], ['Password', f.P], ['Hidden', f.H === 'true' ? 'Yes' : null]].filter(([, v]) => v),
    };
  }
  if (/^mailto:/i.test(t)) return { type: 'Email', href: t };
  if (/^MATMSG:/i.test(t)) {
    const f = parseFields(t.slice(7));
    return { type: 'Email', href: `mailto:${f.TO || ''}?subject=${encodeURIComponent(f.SUB || '')}&body=${encodeURIComponent(f.BODY || '')}` };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { type: 'Email', href: `mailto:${t}` };
  if (/^tel:/i.test(t)) return { type: 'Phone', href: t };
  if (/^(smsto|sms):/i.test(t)) return { type: 'SMS', href: t.replace(/^smsto:([^:]*):?/i, 'sms:$1?body=') };
  if (/^geo:/i.test(t)) return { type: 'Location', href: t };
  if (/^BEGIN:VCARD/i.test(t)) {
    const get = (k) => new RegExp(`^${k}[^:\\n]*:(.*)$`, 'im').exec(t)?.[1]?.trim();
    return { type: 'Contact', details: [['Name', get('FN') || get('N')?.replace(/;/g, ' ').trim()], ['Phone', get('TEL')], ['Email', get('EMAIL')], ['Org', get('ORG')]].filter(([, v]) => v) };
  }
  if (/^MECARD:/i.test(t)) {
    const f = parseFields(t.slice(7));
    return { type: 'Contact', details: [['Name', f.N?.replace(/,/g, ' ')], ['Phone', f.TEL], ['Email', f.EMAIL]].filter(([, v]) => v) };
  }
  if (/^BEGIN:VEVENT/i.test(t)) return { type: 'Calendar event' };
  if (/^\d+$/.test(t)) return { type: 'Number' };
  return { type: 'Text' };
}
