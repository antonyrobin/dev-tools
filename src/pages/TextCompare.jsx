import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import ToolHeader from '../components/ToolHeader';
import ShareHistory from '../components/ShareHistory';
import FindBar from '../components/FindBar';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import {
  GitCompare, ArrowLeftRight, Trash2, PlusCircle, MinusCircle, AlertCircle, Sparkles,
  Maximize2, Minimize2, ArrowUp, ArrowDown, Columns2, Rows2, EyeOff, RefreshCw, CheckCircle2
} from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';
import useMaximize from '../hooks/useMaximize';
import { computeDiff } from '../utils/diff';
import { buildSearchRegex, scanLine, MAX_MATCHES } from '../utils/textSearch';
import { readHandoffId, receivePayload } from '../utils/tabHandoff';
import './TextCompare.css';

const sampleOriginal = `{
  "appName": "DevTools",
  "version": "1.0.0",
  "theme": "dark",
  "features": [
    "Format",
    "Minify",
    "Compile"
  ],
  "author": "DevTools Team"
}`;

const sampleModified = `{
  "appName": "DevTools Suite",
  "version": "1.2.0",
  "theme": "vibrant-dark",
  "features": [
    "Format",
    "Minify",
    "Compile",
    "Text Compare"
  ],
  "status": "active",
  "author": "DevTools Team"
}`;

const EMPTY_DIFF = { rows: [], additionsCount: 0, deletionsCount: 0, modificationsCount: 0 };
const CONTEXT_LINES = 3;
const WORKER_THRESHOLD = 2000; // lines; smaller inputs are diffed synchronously

/** Runs computeDiff in a Web Worker (falls back to the main thread if workers are unavailable). */
function useDiffWorker() {
  const workerRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  return useCallback((original, modified, options) => {
    const lines = original.length + modified.length > 0
      ? original.split('\n').length + modified.split('\n').length
      : 0;
    if (lines < WORKER_THRESHOLD || typeof Worker === 'undefined') {
      return Promise.resolve(computeDiff(original, modified, options));
    }
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(new URL('../utils/diff.worker.js', import.meta.url), { type: 'module' });
      } catch {
        return Promise.resolve(computeDiff(original, modified, options));
      }
    }
    const id = ++seqRef.current;
    const worker = workerRef.current;
    return new Promise((resolve, reject) => {
      const onMessage = (e) => {
        if (e.data.id !== id) return;
        worker.removeEventListener('message', onMessage);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ id, original, modified, options });
    });
  }, []);
}

/**
 * Renders text (or inline-diff tokens) with search highlights.
 * ranges: sorted [{ start, end, idx }] in plain-text offsets of the full line.
 */
function renderContent(tokens, ranges, changedType) {
  if (!tokens || tokens.length === 0) return null;
  const changedClass = changedType === 'remove' ? 'inline-word-remove' : 'inline-word-add';
  const out = [];
  let pos = 0;
  let r = 0;

  tokens.forEach((tok, tokIdx) => {
    const tStart = pos;
    const tEnd = pos + tok.text.length;
    const cls = tok.type === changedType ? changedClass : undefined;

    if (!ranges || r >= ranges.length || ranges[r].start >= tEnd) {
      out.push(cls ? <span key={tokIdx} className={cls}>{tok.text}</span> : tok.text);
    } else {
      const parts = [];
      let cur = tStart;
      while (r < ranges.length && ranges[r].start < tEnd) {
        const s = Math.max(ranges[r].start, cur);
        const e = Math.min(ranges[r].end, tEnd);
        if (s > cur) parts.push(tok.text.slice(cur - tStart, s - tStart));
        parts.push(
          <mark key={`${ranges[r].idx}-${s}`} className="search-match" data-match-idx={ranges[r].idx}>
            {tok.text.slice(s - tStart, e - tStart)}
          </mark>
        );
        cur = e;
        if (ranges[r].end <= tEnd) r++;
        else break;
      }
      if (cur < tEnd) parts.push(tok.text.slice(cur - tStart));
      out.push(<span key={tokIdx} className={cls}>{parts}</span>);
    }
    pos = tEnd;
  });
  return out;
}

const plainTokens = (text) => (text ? [{ text, type: 'same' }] : null);

const SIDE_CLASS = { add: 'pane-added', remove: 'pane-removed', modify: 'pane-modified' };

/**
 * Side-by-side row. Only rows whose own match ranges change re-render; the active match
 * and the focused change block are applied directly to the DOM (see the layout effects).
 */
const SplitRow = React.memo(({ row, rowIdx, leftRanges, rightRanges }) => (
  <div data-row={rowIdx} className={`diff-row split diff-row-${row.type}`}>
    <div className={`diff-cell ${row.left ? (row.type !== 'equal' ? SIDE_CLASS[row.type] : '') : 'pane-empty'}`}>
      <span className="line-num">{row.left ? row.left.lineNum : ''}</span>
      <span className="line-marker">{row.type === 'remove' || row.type === 'modify' ? '−' : ''}</span>
      <span className="line-content">
        {row.left && renderContent(row.leftTokens || plainTokens(row.left.content), leftRanges, 'remove')}
      </span>
    </div>
    <div className={`diff-cell ${row.right ? (row.type !== 'equal' ? SIDE_CLASS[row.type] : '') : 'pane-empty'}`}>
      <span className="line-num">{row.right ? row.right.lineNum : ''}</span>
      <span className="line-marker">{row.type === 'add' || row.type === 'modify' ? '+' : ''}</span>
      <span className="line-content">
        {row.right && renderContent(row.rightTokens || plainTokens(row.right.content), rightRanges, 'add')}
      </span>
    </div>
  </div>
));

/** Unified (single column) line: shows one side of a row. */
const UnifiedLine = React.memo(({ row, rowIdx, side, ranges }) => {
  const isLeft = side === 'left';
  const kind = row.type === 'equal' ? 'equal' : isLeft ? 'remove' : 'add';
  const tokens = isLeft
    ? (row.leftTokens || plainTokens(row.left?.content))
    : (row.rightTokens || plainTokens(row.right?.content));

  return (
    <div data-row={rowIdx} data-side={side} className={`diff-row unified diff-line-${kind}`}>
      <span className="line-num">{row.left && (row.type === 'equal' || isLeft) ? row.left.lineNum : ''}</span>
      <span className="line-num">{row.right && (row.type === 'equal' || !isLeft) ? row.right.lineNum : ''}</span>
      <span className="line-marker">{kind === 'remove' ? '−' : kind === 'add' ? '+' : ''}</span>
      <span className="line-content">{renderContent(tokens, ranges, isLeft ? 'remove' : 'add')}</span>
    </div>
  );
});

/** All diff rows; memoized so navigation state changes in the parent skip it entirely. */
const DiffRows = React.memo(({ displayItems, rows, rangesByKey, viewMode, onShowAll }) => {
  const out = [];
  for (const item of displayItems) {
    if (item.kind === 'gap') {
      out.push(
        <button type="button" key={item.key} className="diff-gap" onClick={onShowAll} title="Show all lines">
          ⋯ {item.count.toLocaleString()} unchanged line{item.count === 1 ? '' : 's'} hidden
        </button>
      );
      continue;
    }
    const { rowIdx } = item;
    const row = rows[rowIdx];
    if (viewMode === 'split') {
      out.push(
        <SplitRow
          key={rowIdx}
          row={row}
          rowIdx={rowIdx}
          leftRanges={rangesByKey.get(`${rowIdx}-left`)}
          rightRanges={rangesByKey.get(`${rowIdx}-right`)}
        />
      );
    } else if (row.type === 'equal') {
      out.push(<UnifiedLine key={rowIdx} row={row} rowIdx={rowIdx} side="right" ranges={rangesByKey.get(`${rowIdx}-right`)} />);
    } else {
      if (row.left) out.push(<UnifiedLine key={`${rowIdx}-l`} row={row} rowIdx={rowIdx} side="left" ranges={rangesByKey.get(`${rowIdx}-left`)} />);
      if (row.right) out.push(<UnifiedLine key={`${rowIdx}-r`} row={row} rowIdx={rowIdx} side="right" ranges={rangesByKey.get(`${rowIdx}-right`)} />);
    }
  }
  return out;
});

const TextCompare = () => {
  // Other tools (e.g. Folder Compare) open a pair of texts here, either via router state
  // or in a new tab with a handoff id whose payload arrives from the opening tab
  const { state: routeState } = useLocation();
  const [handoffId] = useState(readHandoffId);
  const [pairTitle, setPairTitle] = useState(routeState?.title || null);
  usePageTitle(pairTitle ? `${pairTitle} · Compare` : 'Text Comparison');
  const initialPair = routeState?.original !== undefined
    ? { original: routeState.original, modified: routeState.modified ?? '' }
    : handoffId
      ? { original: '', modified: '' }
      : { original: sampleOriginal, modified: sampleModified };
  const [originalText, setOriginalText] = useState(initialPair.original);
  const [modifiedText, setModifiedText] = useState(initialPair.modified);
  const [diffResult, setDiffResult] = useState(() => computeDiff(initialPair.original, initialPair.modified));
  const [isComparing, setIsComparing] = useState(Boolean(handoffId));
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // View options
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 'unified' : 'split'));
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximize();

  // Find state (query is debounced inside FindBar)
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Change navigation
  const [currentChangeIndex, setCurrentChangeIndex] = useState(-1);

  const scrollRef = useRef(null);
  const resultRef = useRef(null);
  const searchInputRef = useRef(null);
  const runDiff = useDiffWorker();

  const { rows } = diffResult;

  // Contiguous non-equal rows form one navigable change block
  const changeBlocks = useMemo(() => {
    const blocks = [];
    let current = null;
    rows.forEach((row, rowIdx) => {
      if (row.type !== 'equal') {
        if (!current) {
          current = { start: rowIdx, end: rowIdx };
          blocks.push(current);
        } else {
          current.end = rowIdx;
        }
      } else {
        current = null;
      }
    });
    return blocks;
  }, [rows]);

  // Row indices to display; with "hide unchanged" only changes plus context are kept
  const displayItems = useMemo(() => {
    if (!hideUnchanged || changeBlocks.length === 0) {
      return rows.map((_, rowIdx) => ({ kind: 'row', rowIdx }));
    }
    const keep = new Uint8Array(rows.length);
    for (const b of changeBlocks) {
      const from = Math.max(0, b.start - CONTEXT_LINES);
      const to = Math.min(rows.length - 1, b.end + CONTEXT_LINES);
      for (let i = from; i <= to; i++) keep[i] = 1;
    }
    const items = [];
    let gap = 0;
    for (let i = 0; i < rows.length; i++) {
      if (keep[i]) {
        if (gap) { items.push({ kind: 'gap', count: gap, key: `gap-${i}` }); gap = 0; }
        items.push({ kind: 'row', rowIdx: i });
      } else {
        gap++;
      }
    }
    if (gap) items.push({ kind: 'gap', count: gap, key: 'gap-end' });
    return items;
  }, [rows, changeBlocks, hideUnchanged]);

  // Search over the displayed content. Unified view shows equal rows once (right side).
  const { rangesByKey, matchesList } = useMemo(() => {
    const regex = buildSearchRegex(searchQuery, { matchCase });
    if (!regex) return { rangesByKey: new Map(), matchesList: [] };

    const byKey = new Map();
    const list = [];
    const scan = (rowIdx, side, text) => scanLine(regex, text, (start, end) => {
      const m = { idx: list.length, rowIdx, side, start, end };
      list.push(m);
      const key = `${rowIdx}-${side}`;
      let arr = byKey.get(key);
      if (!arr) byKey.set(key, (arr = []));
      arr.push(m);
      return list.length < MAX_MATCHES;
    });

    for (const item of displayItems) {
      if (item.kind !== 'row') continue;
      const row = rows[item.rowIdx];
      const searchLeft = row.left && (viewMode === 'split' || row.type !== 'equal');
      if (searchLeft && !scan(item.rowIdx, 'left', row.left.content)) break;
      if (row.right && !scan(item.rowIdx, 'right', row.right.content)) break;
    }
    return { rangesByKey: byKey, matchesList: list };
  }, [rows, displayItems, searchQuery, matchCase, viewMode]);

  const totalMatches = matchesList.length;
  const activeMatch = totalMatches > 0 ? matchesList[Math.min(currentMatchIndex, totalMatches - 1)] : null;

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, matchCase, diffResult, viewMode, hideUnchanged]);

  useEffect(() => {
    setCurrentChangeIndex(-1);
  }, [diffResult]);

  /**
   * Scrolls the diff viewport (never the page) so the row is centred.
   * Off-screen rows use estimated heights (content-visibility), so a second pass corrects drift.
   */
  const scrollToRow = useCallback((rowIdx, side) => {
    const container = scrollRef.current;
    if (!container) return;
    const align = () => {
      const el = (side && viewMode === 'unified' && container.querySelector(`[data-row="${rowIdx}"][data-side="${side}"]`))
        || container.querySelector(`[data-row="${rowIdx}"]`);
      if (!el) return;
      container.scrollTop = el.offsetTop - container.clientHeight / 3;
    };
    align();
    requestAnimationFrame(() => requestAnimationFrame(align));
  }, [viewMode]);

  const showAllLines = useCallback(() => setHideUnchanged(false), []);
  const activeBlock = currentChangeIndex >= 0 ? changeBlocks[currentChangeIndex] : null;

  // Active search match: toggled on the <mark> directly (no React re-render of rows)
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.querySelectorAll('.search-match-active').forEach((el) => el.classList.remove('search-match-active'));
    if (!activeMatch) return;
    const mark = container.querySelector(`mark[data-match-idx="${activeMatch.idx}"]`);
    if (mark) {
      mark.classList.add('search-match-active');
      const row = mark.closest('[data-row]');
      container.scrollTop = row.offsetTop - container.clientHeight / 3;
    } else {
      scrollToRow(activeMatch.rowIdx, activeMatch.side);
    }
  }, [activeMatch, rangesByKey, displayItems, viewMode, scrollToRow]);

  // Focused change block outline, also applied directly to the DOM
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.querySelectorAll('.diff-row-focused').forEach((el) => el.classList.remove('diff-row-focused'));
    if (!activeBlock) return;
    for (let i = activeBlock.start; i <= activeBlock.end; i++) {
      container.querySelectorAll(`[data-row="${i}"]`).forEach((el) => el.classList.add('diff-row-focused'));
    }
  }, [activeBlock, displayItems, viewMode]);

  const goToChange = useCallback((idx) => {
    if (changeBlocks.length === 0) return;
    const wrapped = (idx + changeBlocks.length) % changeBlocks.length;
    setCurrentChangeIndex(wrapped);
    scrollToRow(changeBlocks[wrapped].start);
  }, [changeBlocks, scrollToRow]);

  const handleNextChange = useCallback(() => goToChange(currentChangeIndex + 1), [goToChange, currentChangeIndex]);
  const handlePrevChange = useCallback(() => goToChange(currentChangeIndex <= 0 ? changeBlocks.length - 1 : currentChangeIndex - 1), [goToChange, currentChangeIndex, changeBlocks.length]);

  const handleNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const handlePrevMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const handleCompare = useCallback(async (orig = originalText, mod = modifiedText) => {
    setIsComparing(true);
    setError(null);
    try {
      const res = await runDiff(orig, mod, { ignoreWhitespace, ignoreCase });
      setDiffResult(res);
      setIsStale(false);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    } catch (err) {
      setError(err.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [originalText, modifiedText, runDiff, ignoreWhitespace, ignoreCase]);

  // Re-run when comparison options change
  const optionsKey = `${ignoreWhitespace}-${ignoreCase}`;
  const lastOptionsKey = useRef(optionsKey);
  useEffect(() => {
    if (lastOptionsKey.current === optionsKey) return;
    lastOptionsKey.current = optionsKey;
    handleCompare();
  }, [optionsKey, handleCompare]);

  // Load a pair handed over from another tab
  useEffect(() => {
    if (!handoffId) return;
    let cancelled = false;
    receivePayload(handoffId).then((payload) => {
      if (cancelled) return;
      if (!payload) {
        setIsComparing(false);
        setError('The files to compare are no longer available. Open them again from Folder Compare.');
        return;
      }
      setOriginalText(payload.original ?? '');
      setModifiedText(payload.modified ?? '');
      if (payload.title) setPairTitle(payload.title);
      compareRef.current(payload.original ?? '', payload.modified ?? '');
    });
    return () => { cancelled = true; };
  }, [handoffId]);

  const handleSwap = () => {
    setOriginalText(modifiedText);
    setModifiedText(originalText);
    handleCompare(modifiedText, originalText);
  };

  const handleClear = () => {
    setOriginalText('');
    setModifiedText('');
    setDiffResult(EMPTY_DIFF);
    setIsStale(false);
  };

  const handleLoadSample = () => {
    setOriginalText(sampleOriginal);
    setModifiedText(sampleModified);
    handleCompare(sampleOriginal, sampleModified);
  };

  // Ctrl/Cmd+Enter compares from anywhere on the page
  const compareRef = useRef(handleCompare);
  compareRef.current = handleCompare;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compareRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keyboard shortcuts inside the result panel
  const handlePanelKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (e.key === 'F7' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
      e.preventDefault();
      if (e.shiftKey || e.key === 'ArrowUp') handlePrevChange(); else handleNextChange();
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) handlePrevMatch(); else handleNextMatch();
    }
  };


  const identical = rows.length > 0 && changeBlocks.length === 0;
  const totalChanges = diffResult.additionsCount + diffResult.deletionsCount + diffResult.modificationsCount;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Text Compare"
        description="Compare two texts with side-by-side or unified diffs, inline word changes, change navigation and fast find."
        icon={GitCompare}
        color="var(--accent)"
      >
        <ShareHistory
          toolId="compare"
          state={{ original: originalText, modified: modifiedText }}
          describe={(st) => `${st.original.trim().replace(/\s+/g, ' ').slice(0, 36)} ↔ ${st.modified.trim().replace(/\s+/g, ' ').slice(0, 36)}`}
          isEmpty={(st) => (!st.original.trim() && !st.modified.trim()) || (st.original === sampleOriginal && st.modified === sampleModified)}
          onRestore={(st) => {
            setOriginalText(st.original || '');
            setModifiedText(st.modified || '');
            handleCompare(st.original || '', st.modified || '');
          }}
        />
      </ToolHeader>

      {/* Controls */}
      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <button className="btn btn-ghost btn-sm" onClick={handleLoadSample}>
            <Sparkles size={15} /> <span>Sample</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleSwap} title="Swap original and modified">
            <ArrowLeftRight size={15} /> <span>Swap</span>
          </button>
          <label className="check-toggle">
            <input type="checkbox" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} />
            <span>Ignore whitespace</span>
          </label>
          <label className="check-toggle">
            <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
            <span>Ignore case</span>
          </label>
          <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={handleClear}>
            <Trash2 size={15} /> <span>Clear</span>
          </button>
        </div>

        <button className="btn btn-primary" onClick={() => handleCompare()} disabled={isComparing} title="Compare (Ctrl+Enter)">
          {isComparing ? <RefreshCw size={16} className="animate-spin" /> : <GitCompare size={16} />}
          <span>{isComparing ? 'Comparing…' : 'Compare'}</span>
        </button>
      </div>

      {pairTitle && (
        <div className="compare-pair-title text-sm text-muted">Comparing <code title={pairTitle}>{pairTitle}</code></div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Inputs */}
      <div className="editor-split compare-inputs">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title"><span className="side-dot side-dot-left" /> Original</span>
            <UploadButton label="Upload" className="btn btn-ghost btn-xs" onFileLoaded={(res) => { setOriginalText(res.content); setIsStale(true); }} onError={setError} />
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={originalText}
              onChange={(val) => { setOriginalText(val); setIsStale(true); }}
              placeholder="Paste or drag & drop the original text…"
              lineNumbers
            />
          </div>
          <div className="code-panel-footer">
            <span>{originalText ? originalText.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{originalText.length.toLocaleString()} chars</span>
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title"><span className="side-dot side-dot-right" /> Modified</span>
            <UploadButton label="Upload" className="btn btn-ghost btn-xs" onFileLoaded={(res) => { setModifiedText(res.content); setIsStale(true); }} onError={setError} />
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={modifiedText}
              onChange={(val) => { setModifiedText(val); setIsStale(true); }}
              placeholder="Paste or drag & drop the modified text…"
              lineNumbers
            />
          </div>
          <div className="code-panel-footer">
            <span>{modifiedText ? modifiedText.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{modifiedText.length.toLocaleString()} chars</span>
          </div>
        </div>
      </div>

      {/* Result */}
      {rows.length > 0 && (
        <div ref={resultRef} className="compare-result">
          <div className={`code-panel diff-panel ${isMaximized ? 'is-maximized' : ''}`} onKeyDown={handlePanelKeyDown}>
            <div className="code-panel-header diff-header">
              <div className="diff-header-left">
                <span className="code-panel-title">Result</span>
                <span className="diff-pill diff-pill-add" title="Additions"><PlusCircle size={13} /> {diffResult.additionsCount}</span>
                <span className="diff-pill diff-pill-remove" title="Deletions"><MinusCircle size={13} /> {diffResult.deletionsCount}</span>
                <span className="diff-pill diff-pill-modify" title="Modifications"><AlertCircle size={13} /> {diffResult.modificationsCount}</span>
                {isStale && <span className="stale-hint">Inputs changed — press Compare</span>}
              </div>

              <FindBar
                inputRef={searchInputRef}
                onQueryChange={setSearchQuery}
                total={totalMatches}
                current={currentMatchIndex}
                onNext={handleNextMatch}
                onPrev={handlePrevMatch}
                matchCase={matchCase}
                onToggleMatchCase={() => setMatchCase(v => !v)}
                placeholder="Find in diff (Ctrl+F)"
              />

              <div className="code-panel-actions">
                <div className="change-nav" title="Navigate changes (F7 / Shift+F7, Alt+↑/↓)">
                  <span className="change-nav-label">
                    {changeBlocks.length === 0 ? 'No changes' : `Change ${currentChangeIndex >= 0 ? currentChangeIndex + 1 : '–'} / ${changeBlocks.length}`}
                  </span>
                  <button className="btn btn-ghost btn-xs" onClick={handlePrevChange} disabled={changeBlocks.length === 0} title="Previous change (Shift+F7)">
                    <ArrowUp size={14} />
                  </button>
                  <button className="btn btn-ghost btn-xs" onClick={handleNextChange} disabled={changeBlocks.length === 0} title="Next change (F7)">
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className="segmented" role="group" aria-label="View mode">
                  <button type="button" className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')} title="Side by side">
                    <Columns2 size={14} /><span className="hide-mobile-text">Split</span>
                  </button>
                  <button type="button" className={viewMode === 'unified' ? 'active' : ''} onClick={() => setViewMode('unified')} title="Unified">
                    <Rows2 size={14} /><span className="hide-mobile-text">Unified</span>
                  </button>
                </div>

                <button
                  className={`btn btn-ghost btn-xs ${hideUnchanged ? 'is-active' : ''}`}
                  onClick={() => setHideUnchanged(v => !v)}
                  title="Show only changes with context"
                  aria-pressed={hideUnchanged}
                  disabled={changeBlocks.length === 0}
                >
                  <EyeOff size={14} /><span className="hide-mobile-text">Changes only</span>
                </button>

                <button className="btn btn-ghost btn-xs" onClick={() => setIsMaximized(v => !v)} title={isMaximized ? 'Exit full screen (Esc)' : 'Full screen'}>
                  {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            <div className="code-panel-body diff-body">
              {identical ? (
                <div className="diff-identical">
                  <CheckCircle2 size={28} className="text-success" />
                  <span>The texts are identical{ignoreWhitespace || ignoreCase ? ' (with the selected ignore options)' : ''}.</span>
                </div>
              ) : (
                <>
                  {viewMode === 'split' && (
                    <div className="diff-columns-header">
                      <span>Original</span>
                      <span>Modified</span>
                    </div>
                  )}
                  <div ref={scrollRef} className={`diff-scroll ${viewMode}`} tabIndex={0}>
                    <DiffRows
                      displayItems={displayItems}
                      rows={rows}
                      rangesByKey={rangesByKey}
                      viewMode={viewMode}
                      onShowAll={showAllLines}
                    />
                  </div>

                  {/* Overview ruler: where the changes are in the whole file */}
                  <div className="diff-overview" aria-hidden="true">
                    {changeBlocks.map((b, i) => {
                      const type = rows[b.start].type;
                      return (
                        <span
                          key={b.start}
                          className={`diff-overview-mark mark-${type} ${i === currentChangeIndex ? 'active' : ''}`}
                          style={{ top: `${(b.start / rows.length) * 100}%`, height: `max(3px, ${((b.end - b.start + 1) / rows.length) * 100}%)` }}
                          onClick={() => goToChange(i)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="code-panel-footer">
              <span>{rows.length.toLocaleString()} rows · {totalChanges.toLocaleString()} changed lines</span>
              <span>{totalMatches > 0 ? `${totalMatches.toLocaleString()} matches` : ''}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextCompare;
