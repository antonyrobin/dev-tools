// Hands data (e.g. two files to compare) from one tab to a tool opened in a new tab.
// Router state does not survive window.open and localStorage is too small for real files,
// so the new tab asks for its payload over a BroadcastChannel and the opening tab answers.

const CHANNEL = 'devtools-handoff';
const PARAM = 'handoff';
const SERVE_TIMEOUT = 2 * 60 * 1000;
const STORAGE_PREFIX = 'devtools:handoff:';

export const canHandoff = () => typeof BroadcastChannel !== 'undefined';

/**
 * Opens `path` in a new tab and serves `payload` whenever it asks (for a while, so a reload
 * of that tab still works). Returns false if the tab could not be opened.
 */
export function openWithPayload(path, payload) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const channel = new BroadcastChannel(CHANNEL);
  const close = () => { clearTimeout(timer); channel.close(); };
  const timer = setTimeout(close, SERVE_TIMEOUT);
  channel.onmessage = (e) => {
    if (e.data?.type !== 'request' || e.data.id !== id) return;
    channel.postMessage({ type: 'payload', id, payload });
  };

  const sep = path.includes('?') ? '&' : '?';
  const win = window.open(`${path}${sep}${PARAM}=${id}`, '_blank');
  if (!win) { close(); return false; }
  win.opener = null;
  return true;
}

/** The handoff id in the current URL, if this tab was opened by openWithPayload. */
export const readHandoffId = () => new URLSearchParams(window.location.search).get(PARAM);

const pending = new Map();

/**
 * Fetches the payload for `id` from the tab that opened this one. Calls for the same id share
 * one request; the result is kept in sessionStorage (when it fits) for reloads of this tab.
 */
export function receivePayload(id, timeout = 5000) {
  if (!pending.has(id)) pending.set(id, requestPayload(id, timeout));
  return pending.get(id);
}

function requestPayload(id, timeout) {
  try {
    const saved = sessionStorage.getItem(STORAGE_PREFIX + id);
    if (saved) return Promise.resolve(JSON.parse(saved));
  } catch { /* storage unavailable */ }

  if (!canHandoff()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL);
    const finish = (payload) => { clearTimeout(timer); channel.close(); resolve(payload); };
    const timer = setTimeout(() => finish(null), timeout);
    channel.onmessage = (e) => {
      if (e.data?.type !== 'payload' || e.data.id !== id) return;
      try { sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(e.data.payload)); } catch { /* too large: reload won't restore */ }
      finish(e.data.payload);
    };
    channel.postMessage({ type: 'request', id });
  });
}
