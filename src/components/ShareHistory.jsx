import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link2, Check, History, X, Trash2, AlertTriangle } from 'lucide-react';
import {
  buildShareUrl, decodeState, readSharedPayload, MAX_SHARE_URL_LENGTH,
  loadHistory, addHistoryEntry, removeHistoryEntry, clearHistory,
} from '../utils/share';
import './ShareHistory.css';

const AUTOSAVE_DELAY = 1500;

const relativeTime = (time) => {
  const diff = (Date.now() - time) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(time).toLocaleDateString();
};

const defaultDescribe = (state) => {
  const text = Object.values(state).find((v) => typeof v === 'string' && v.trim()) || '';
  return text.trim().replace(/\s+/g, ' ').slice(0, 80) || '(empty)';
};

/**
 * "Share" (content in the URL) and "History" (recent inputs in localStorage) for a tool.
 *
 * state:     plain JSON-serialisable object describing the tool input
 * onRestore: called with a state object from a shared link or a history entry
 * isEmpty:   optional predicate; empty states are never saved to history
 */
const ShareHistory = ({ toolId, state, onRestore, describe = defaultDescribe, isEmpty }) => {
  const [entries, setEntries] = useState(() => loadHistory(toolId));
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const wrapRef = useRef(null);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;

  const stateJson = JSON.stringify(state);
  const initialJson = useRef(stateJson);

  const flash = useCallback((type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), type === 'error' ? 5000 : 2200);
  }, []);

  // Load content from a shared link once, then drop it from the address bar
  useEffect(() => {
    const payload = readSharedPayload();
    if (!payload) return;
    decodeState(payload)
      .then((shared) => {
        restoreRef.current(shared);
        flash('success', 'Loaded shared content');
      })
      .catch(() => flash('error', 'This share link is invalid or damaged'))
      .finally(() => {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      });
  }, [flash]);

  // Autosave to history once the user has changed something
  useEffect(() => {
    if (stateJson === initialJson.current) return;
    const current = JSON.parse(stateJson);
    if (isEmpty ? isEmpty(current) : defaultDescribe(current) === '(empty)') return;
    const t = setTimeout(() => setEntries(addHistoryEntry(toolId, current, describe(current))), AUTOSAVE_DELAY);
    return () => clearTimeout(t);
    // describe / isEmpty are presentation helpers; re-running on their identity is unnecessary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateJson, toolId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleShare = async () => {
    try {
      const url = await buildShareUrl(state);
      if (url.length > MAX_SHARE_URL_LENGTH) {
        flash('error', `Too large for a link (${Math.round(url.length / 1024)} KB). Trim the input or download it instead.`);
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('success', 'Link copied — the content travels inside the URL');
    } catch {
      flash('error', 'Could not create or copy the link');
    }
  };

  const handleRestore = (entry) => {
    onRestore(entry.state);
    setOpen(false);
  };

  return (
    <div className="share-history" ref={wrapRef}>
      <button type="button" className="btn btn-outline btn-sm" onClick={handleShare} title="Copy a link that contains this input">
        {notice?.type === 'success' ? <Check size={15} className="text-success" /> : <Link2 size={15} />}
        <span>Share</span>
      </button>
      <button
        type="button"
        className={`btn btn-outline btn-sm ${open ? 'is-active' : ''}`}
        onClick={() => { setEntries(loadHistory(toolId)); setOpen((o) => !o); }}
        aria-expanded={open}
        title="Recent inputs saved in this browser"
      >
        <History size={15} />
        <span>History</span>
        {entries.length > 0 && <span className="sh-count">{entries.length}</span>}
      </button>

      {notice && (
        <div className={`sh-toast sh-toast-${notice.type}`} role="status">
          {notice.type === 'error' ? <AlertTriangle size={14} /> : <Check size={14} />}
          <span>{notice.text}</span>
        </div>
      )}

      {open && (
        <div className="sh-popover" role="dialog" aria-label="Recent inputs">
          <div className="sh-popover-head">
            <span>Recent inputs</span>
            {entries.length > 0 && (
              <button type="button" className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setEntries(clearHistory(toolId))}>
                <Trash2 size={13} /> Clear all
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="sh-empty">Nothing yet. Inputs you work with are saved here automatically, only in this browser.</p>
          ) : (
            <ul className="sh-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="sh-item" onClick={() => handleRestore(entry)}>
                    <span className="sh-item-label">{entry.label}</span>
                    <span className="sh-item-time">{relativeTime(entry.time)}</span>
                  </button>
                  <button
                    type="button"
                    className="sh-remove"
                    onClick={() => setEntries(removeHistoryEntry(toolId, entry.id))}
                    aria-label="Remove from history"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ShareHistory;
