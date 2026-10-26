// Encodes tool state into a compact, URL-safe string so a link can carry the content itself.
// Format: 'z' + base64url(deflate-raw(json)) when CompressionStream exists, else 'j' + base64url(json).

const toBase64Url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const pipe = async (bytes, transform) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer());

export async function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream !== 'undefined') {
    return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toBase64Url(bytes);
}

export async function decodeState(encoded) {
  const kind = encoded[0];
  let bytes = fromBase64Url(encoded.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('Unknown share format');
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const SHARE_PARAM = 's';
// Most browsers and chat apps cope with links up to roughly this size
export const MAX_SHARE_URL_LENGTH = 64000;

export async function buildShareUrl(state) {
  const url = new URL(window.location.href);
  url.hash = `${SHARE_PARAM}=${await encodeState(state)}`;
  return url.toString();
}

/** Returns the encoded payload from the current URL hash, if any. */
export function readSharedPayload() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get(SHARE_PARAM);
}

// ===== Local history =====

const HISTORY_LIMIT = 25;
const MAX_ENTRY_CHARS = 300000;
const historyKey = (toolId) => `devtools:history:${toolId}`;

export function loadHistory(toolId) {
  try {
    return JSON.parse(localStorage.getItem(historyKey(toolId))) || [];
  } catch {
    return [];
  }
}

function saveHistory(toolId, entries) {
  try {
    localStorage.setItem(historyKey(toolId), JSON.stringify(entries));
    return entries;
  } catch {
    // Quota exceeded: keep the newest half and try once more
    const trimmed = entries.slice(0, Math.ceil(entries.length / 2));
    try { localStorage.setItem(historyKey(toolId), JSON.stringify(trimmed)); } catch { /* give up */ }
    return trimmed;
  }
}

/** Adds (or moves to the top) an entry; identical states are stored once. */
export function addHistoryEntry(toolId, state, label) {
  const json = JSON.stringify(state);
  if (json.length > MAX_ENTRY_CHARS) return loadHistory(toolId);
  const entries = loadHistory(toolId).filter((e) => JSON.stringify(e.state) !== json);
  entries.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), time: Date.now(), label, state });
  return saveHistory(toolId, entries.slice(0, HISTORY_LIMIT));
}

export function removeHistoryEntry(toolId, id) {
  return saveHistory(toolId, loadHistory(toolId).filter((e) => e.id !== id));
}

export function clearHistory(toolId) {
  try { localStorage.removeItem(historyKey(toolId)); } catch { /* ignore */ }
  return [];
}
