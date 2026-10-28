import { decodeLuminance, toLuminance } from './zxingDecode';

// Barcode decoding can take a second or more on big photos; keep it off the main thread
self.onmessage = (e) => {
  const { id, pixels, width, height, frame } = e.data;
  try {
    const codes = decodeLuminance(toLuminance(pixels, width, height), width, height, { frame });
    self.postMessage({ id, codes });
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Decoding failed' });
  }
};
