// Shared helpers for the image tools: decoding, drawing with resize/crop/rotate/flip,
// and encoding to PNG / JPEG / WebP / AVIF (via canvas) or BMP / ICO (written by hand).
// Everything runs locally; canvases drop EXIF and other metadata as a side effect.

export const IMAGE_FORMATS = [
  { mime: 'image/png', label: 'PNG', ext: 'png', lossy: false, alpha: true },
  { mime: 'image/jpeg', label: 'JPEG', ext: 'jpg', lossy: true, alpha: false },
  { mime: 'image/webp', label: 'WebP', ext: 'webp', lossy: true, alpha: true },
  { mime: 'image/avif', label: 'AVIF', ext: 'avif', lossy: true, alpha: true },
  { mime: 'image/bmp', label: 'BMP', ext: 'bmp', lossy: false, alpha: false },
  { mime: 'image/x-icon', label: 'ICO', ext: 'ico', lossy: false, alpha: true },
];

export const formatByMime = (mime) => IMAGE_FORMATS.find((f) => f.mime === mime);

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

const CUSTOM_ENCODERS = new Set(['image/bmp', 'image/x-icon']);
const support = new Map();

/** Whether this browser can write `mime` (Chrome can't encode AVIF, Safari can't encode WebP). */
export const canEncode = (mime) => {
  if (CUSTOM_ENCODERS.has(mime)) return true;
  if (!support.has(mime)) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    support.set(mime, c.toDataURL(mime).startsWith(`data:${mime}`));
  }
  return support.get(mime);
};

export const encodableFormats = () => IMAGE_FORMATS.filter((f) => canEncode(f.mime));

export const formatBytes = (n) => {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

export const baseName = (name) => (name || 'image').replace(/\.[^.]+$/, '') || 'image';

/** Decodes a File/Blob (or URL) into a loaded <img>. SVGs without a size get 512px. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      img.sourceWidth = img.naturalWidth || 512;
      img.sourceHeight = img.naturalHeight || 512;
      resolve(img);
    };
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      reject(new Error('This file could not be decoded as an image by your browser.'));
    };
    img.src = url;
  });
}

/** Scales (w, h) down to fit inside maxW × maxH (either may be empty); never upscales. */
export const fitWithin = (w, h, maxW, maxH) => {
  let scale = 1;
  if (maxW > 0 && w > maxW) scale = Math.min(scale, maxW / w);
  if (maxH > 0 && h > maxH) scale = Math.min(scale, maxH / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
};

/** Centered crop rectangle with the given aspect ratio (w / h), or the full image. */
export const centerCrop = (w, h, aspect) => {
  if (!aspect) return { x: 0, y: 0, w, h };
  if (w / h > aspect) {
    const cw = Math.round(h * aspect);
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h };
  }
  const ch = Math.round(w / aspect);
  return { x: 0, y: Math.round((h - ch) / 2), w, h: ch };
};

/**
 * Draws `img` onto a new canvas.
 * crop is in source pixels; width/height size the cropped area before rotation (90° steps).
 */
export function renderImage(img, { width, height, crop, rotate = 0, flipH = false, flipV = false, background } = {}) {
  const src = crop || { x: 0, y: 0, w: img.sourceWidth || img.naturalWidth, h: img.sourceHeight || img.naturalHeight };
  const w = Math.max(1, Math.round(width || src.w));
  const h = Math.max(1, Math.round(height || src.h));
  const swap = ((rotate % 360) + 360) % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, src.x, src.y, src.w, src.h, -w / 2, -h / 2, w, h);
  return canvas;
}

/** Draws `img` centered in a size × size square (for icons). */
export function renderSquare(img, size, { background, padding = 0, radius = 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (radius > 0) {
    const r = (size * radius) / 100;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.clip();
  }
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const inner = size * (1 - (2 * padding) / 100);
  const iw = img.sourceWidth || img.naturalWidth || img.width;
  const ih = img.sourceHeight || img.naturalHeight || img.height;
  const scale = Math.min(inner / iw, inner / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return canvas;
}

const toBlob = (canvas, mime, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Your browser can't create ${mime} images.`))), mime, quality);
  });

// 24-bit bottom-up BMP
function encodeBmp(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  v.setUint16(0, 0x424d);
  v.setUint32(2, size, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  v.setUint32(34, rowSize * height, true);
  v.setInt32(38, 2835, true);
  v.setInt32(42, 2835, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < height; y++) {
    let o = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out[o++] = data[i + 2];
      out[o++] = data[i + 1];
      out[o++] = data[i];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

/** ICO file holding one PNG per size (supported by every browser and Windows Vista+). */
export async function encodeIco(img, sizes = [16, 32, 48], options = {}) {
  const pngs = await Promise.all(
    sizes.map(async (s) => new Uint8Array(await (await toBlob(renderSquare(img, s, options), 'image/png')).arrayBuffer()))
  );
  const headerSize = 6 + 16 * sizes.length;
  const total = headerSize + pngs.reduce((n, p) => n + p.length, 0);
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  v.setUint16(2, 1, true);
  v.setUint16(4, sizes.length, true);
  let offset = headerSize;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    v.setUint8(e, s >= 256 ? 0 : s);
    v.setUint8(e + 1, s >= 256 ? 0 : s);
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, pngs[i].length, true);
    v.setUint32(e + 12, offset, true);
    new Uint8Array(buf, offset, pngs[i].length).set(pngs[i]);
    offset += pngs[i].length;
  });
  return new Blob([buf], { type: 'image/x-icon' });
}

/** Encodes a canvas; quality (0–1) applies to lossy formats only. */
export async function encodeCanvas(canvas, mime, quality = 0.85) {
  if (mime === 'image/bmp') return encodeBmp(canvas);
  if (mime === 'image/x-icon') {
    const sizes = [16, 32, 48, 64, 128, 256].filter((s) => s <= Math.max(canvas.width, canvas.height));
    return encodeIco(canvas, sizes.length ? sizes : [16]);
  }
  return toBlob(canvas, mime, formatByMime(mime)?.lossy ? quality : undefined);
}

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Zips [{ name, blob }] and downloads it; duplicate names get a numeric suffix. */
export async function downloadZip(files, zipName) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Map();
  files.forEach(({ name, blob }) => {
    let finalName = name;
    const n = used.get(name) || 0;
    if (n) finalName = name.replace(/(\.[^.]+)?$/, `-${n}$1`);
    used.set(name, n + 1);
    zip.file(finalName, blob);
  });
  downloadBlob(await zip.generateAsync({ type: 'blob' }), zipName);
}

/** Image files from a drop, paste or <input> event. */
export const imageFilesFrom = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/') || /\.(svg|ico|avif|heic)$/i.test(f.name));
