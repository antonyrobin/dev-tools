// Colour parsing and conversions. Parsing defers to the browser (canvas) so every CSS colour
// syntax it supports — names, hex, rgb(), hsl(), hwb(), lab(), oklch() — is accepted.

let ctx = null;
const getCtx = () => {
  if (!ctx) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return ctx;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Returns { r, g, b, a } (0–255, alpha 0–1) or null. */
export function parseColor(input) {
  let text = input.trim();
  if (!text) return null;
  if (/^[0-9a-f]{3,8}$/i.test(text) && [3, 4, 6, 8].includes(text.length)) text = `#${text}`;
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?$/.test(text)) text = `rgb(${text})`;
  if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('color', text)) return null;

  const c = getCtx();
  c.fillStyle = '#000';
  c.fillStyle = text;
  const style = c.fillStyle;

  const hex = style.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = style.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };

  // Wide-gamut syntaxes come back unconverted: rasterise one pixel to read sRGB values
  c.clearRect(0, 0, 1, 1);
  c.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
  return a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: Math.round((r * 255) / a), g: Math.round((g * 255) / a), b: Math.round((b * 255) / a), a: +(a / 255).toFixed(3) };
}

const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: round(h), s: round(s * 100), l: round(l * 100) };
}

export function rgbToHwb(rgb) {
  const { h } = rgbToHsl(rgb);
  const w = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  const bl = 1 - Math.max(rgb.r, rgb.g, rgb.b) / 255;
  return { h, w: round(w * 100), b: round(bl * 100) };
}

export function rgbToCmyk({ r, g, b }) {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: round(((1 - r / 255 - k) / (1 - k)) * 100),
    m: round(((1 - g / 255 - k) / (1 - k)) * 100),
    y: round(((1 - b / 255 - k) / (1 - k)) * 100),
    k: round(k * 100),
  };
}

const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function rgbToOklch({ r, g, b }) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: round(L * 100, 2), c: round(C, 4), h: C < 0.0002 ? 0 : round(H, 2) };
}

export const relativeLuminance = ({ r, g, b }) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

export function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

export const toHex = ({ r, g, b, a = 1 }, withAlpha = false) =>
  `#${hex2(r)}${hex2(g)}${hex2(b)}${withAlpha || a < 1 ? hex2(a * 255) : ''}`;

export function mix(c1, c2, weight) {
  return { r: c1.r + (c2.r - c1.r) * weight, g: c1.g + (c2.g - c1.g) * weight, b: c1.b + (c2.b - c1.b) * weight, a: 1 };
}

/** All textual representations of a colour. */
export function formatsOf(color) {
  const { r, g, b, a } = color;
  const alpha = a < 1 ? ` / ${round(a, 3)}` : '';
  const hsl = rgbToHsl(color);
  const hwb = rgbToHwb(color);
  const cmyk = rgbToCmyk(color);
  const ok = rgbToOklch(color);
  return [
    ['HEX', toHex(color)],
    ['HEX + alpha', toHex(color, true)],
    ['RGB', a < 1 ? `rgba(${r}, ${g}, ${b}, ${round(a, 3)})` : `rgb(${r}, ${g}, ${b})`],
    ['HSL', a < 1 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(a, 3)})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
    ['HWB', `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%${alpha})`],
    ['OKLCH', `oklch(${ok.l}% ${ok.c} ${ok.h}${alpha})`],
    ['CMYK', `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
    ['RGB (0–1)', `${round(r / 255, 4)}, ${round(g / 255, 4)}, ${round(b / 255, 4)}`],
  ];
}
