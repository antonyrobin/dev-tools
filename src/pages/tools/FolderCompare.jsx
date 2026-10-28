import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2, FolderOpen, Files, FileArchive, X, GitCompare, ChevronRight, ChevronDown, Folder, File,
  ChevronsUpDown, ChevronsDownUp, Download, AlertTriangle, RefreshCw, ArrowLeftRight, ExternalLink, CheckCircle2,
  Maximize2, Minimize2,
} from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import useMaximize from '../../hooks/useMaximize';
import { canHandoff, openWithPayload } from '../../utils/tabHandoff';
import { loadFileList, loadZip, loadDataTransfer, compareSources, buildTree, isBinary } from '../../utils/folderCompare';
import { computeDiff } from '../../utils/diff';
import './Tools.css';
import '../TextCompare.css';
import './FolderCompare.css';

const FILTERS = [
  { id: 'changes', label: 'Changes', match: (s) => s !== 'same' },
  { id: 'added', label: 'Added', match: (s) => s === 'added' },
  { id: 'removed', label: 'Removed', match: (s) => s === 'removed' },
  { id: 'modified', label: 'Modified', match: (s) => s === 'modified' },
  { id: 'same', label: 'Identical', match: (s) => s === 'same' },
  { id: 'all', label: 'All', match: () => true },
];

const STATUS_LABEL = { added: 'Added', removed: 'Removed', modified: 'Modified', same: 'Identical' };
const MAX_DIFF_BYTES = 2 * 1024 * 1024;

const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

const SourcePicker = ({ side, title, source, loading, onLoad, onClear }) => {
  const [dragging, setDragging] = useState(false);

  const handle = async (loader) => {
    try {
      onLoad({ loading: true });
      onLoad({ source: await loader() });
    } catch (err) {
      onLoad({ error: err.message || 'Could not read the selection' });
    }
  };

  const pick = (e, kind) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    e.target.value = '';
    if (kind === 'zip') handle(() => loadZip(list[0]));
    else handle(() => loadFileList(list, kind === 'folder' ? 'Folder' : `${list.length} files`));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dt = e.dataTransfer;
    handle(() => loadDataTransfer(dt));
  };

  return (
    <div
      className={`fc-source ${dragging ? 'dragging' : ''} ${source ? 'loaded' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="fc-source-head">
        <span className="code-panel-title"><span className={`side-dot side-dot-${side}`} /> {title}</span>
        {source && <button className="btn btn-ghost btn-xs" onClick={onClear} title="Clear"><X size={14} /></button>}
      </div>

      {loading ? (
        <div className="fc-source-body"><RefreshCw size={22} className="animate-spin text-primary" /><span>Reading…</span></div>
      ) : source ? (
        <div className="fc-source-body">
          <FolderOpen size={26} className="text-primary" />
          <strong className="fc-source-label" title={source.label}>{source.label}</strong>
          <span className="text-sm text-muted">{source.entries.length.toLocaleString()} files · {formatBytes(source.total)}</span>
        </div>
      ) : (
        <div className="fc-source-body">
          <span className="text-sm text-muted">Drop a folder, files or a .zip here</span>
        </div>
      )}

      <div className="fc-source-actions">
        <label className="btn btn-outline btn-sm">
          <FolderOpen size={15} /> Folder
          <input type="file" hidden webkitdirectory="" directory="" multiple onChange={(e) => pick(e, 'folder')} />
        </label>
        <label className="btn btn-outline btn-sm">
          <Files size={15} /> Files
          <input type="file" hidden multiple onChange={(e) => pick(e, 'files')} />
        </label>
        <label className="btn btn-outline btn-sm">
          <FileArchive size={15} /> ZIP
          <input type="file" hidden accept=".zip,application/zip" onChange={(e) => pick(e, 'zip')} />
        </label>
      </div>
    </div>
  );
};

const StatusPill = ({ status }) => <span className={`fc-pill fc-${status}`}>{STATUS_LABEL[status]}</span>;

const TreeNode = ({ node, depth, expanded, toggle, selected, onSelect, filter }) => {
  if (node.file) {
    if (!filter(node.file.status)) return null;
    return (
      <button
        type="button"
        className={`fc-row fc-file fc-status-${node.file.status} ${selected === node.path ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 26}px` }}
        onClick={() => onSelect(node.file)}
      >
        <File size={14} className="fc-icon" />
        <span className="fc-name">{node.name}</span>
        <StatusPill status={node.file.status} />
      </button>
    );
  }
  const visible = Object.entries(node.counts).some(([s, n]) => n > 0 && filter(s));
  if (!visible) return null;
  const open = expanded.has(node.path);
  const changed = node.counts.added + node.counts.removed + node.counts.modified;
  const children = [...node.children.values()].sort((a, b) => (!!a.file - !!b.file) || a.name.localeCompare(b.name));
  return (
    <>
      <button type="button" className={`fc-row fc-dir ${changed ? 'has-changes' : ''}`} style={{ paddingLeft: `${depth * 16 + 6}px` }} onClick={() => toggle(node.path)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} className="fc-icon" />
        <span className="fc-name">{node.name}</span>
        {changed > 0 && <span className="fc-dir-count">{changed} changed</span>}
      </button>
      {open && children.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} onSelect={onSelect} filter={filter} />
      ))}
    </>
  );
};

const allDirPaths = (node, out = []) => {
  for (const child of node.children.values()) {
    if (!child.file) { out.push(child.path); allDirPaths(child, out); }
  }
  return out;
};

const FileDiff = ({ item }) => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lb, rb] = await Promise.all([item.left?.read(), item.right?.read()]);
      if (cancelled) return;
      if ((lb && isBinary(lb)) || (rb && isBinary(rb))) {
        setState({ binary: true, leftSize: lb?.length, rightSize: rb?.length });
        return;
      }
      const dec = new TextDecoder();
      const original = lb ? dec.decode(lb) : '';
      const modified = rb ? dec.decode(rb) : '';
      if ((lb?.length || 0) + (rb?.length || 0) > MAX_DIFF_BYTES) {
        // Text Compare diffs in a worker, so it can still take these
        setState({ tooLarge: true, original, modified });
        return;
      }
      setState({ original, modified, diff: computeDiff(original, modified) });
    })().catch((err) => !cancelled && setState({ error: err.message }));
    return () => { cancelled = true; };
  }, [item]);

  return (
    <div className="code-panel fc-diff">
      <div className="code-panel-header">
        <span className="code-panel-title fc-diff-title" title={item.path}><StatusPill status={item.status} /> {item.path}</span>
        {state.original !== undefined && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => {
              const pair = { original: state.original, modified: state.modified, title: item.path };
              // New tab keeps this comparison open; fall back to this tab if the browser blocks it
              if (!canHandoff() || !openWithPayload('/compare', pair)) navigate('/compare', { state: pair });
            }}
            title="Open this pair in Text Compare (new tab)"
          >
            <ExternalLink size={14} /><span className="hide-mobile-text">Open in Text Compare</span>
          </button>
        )}
      </div>
      <div className="code-panel-body">
        {state.loading && <div className="empty-hint">Loading…</div>}
        {state.error && <div className="inline-error p-4"><AlertTriangle size={15} /> {state.error}</div>}
        {state.tooLarge && <div className="empty-hint">These files are too large to diff here. Use “Open in Text Compare” to compare them in a new tab.</div>}
        {state.binary && (
          <div className="empty-hint">
            Binary file{item.status === 'modified' ? 's differ' : ''}.
            {state.leftSize !== undefined && <> Original: {formatBytes(state.leftSize)}.</>}
            {state.rightSize !== undefined && <> Modified: {formatBytes(state.rightSize)}.</>}
          </div>
        )}
        {state.diff && (
          item.status === 'same' ? (
            <div className="diff-identical"><CheckCircle2 size={24} className="text-success" /> Identical contents.</div>
          ) : (
            <div className="diff-scroll unified">
              {state.diff.rows.map((row, i) => {
                const lines = [];
                if (row.type === 'equal') lines.push(['equal', row.right]);
                else {
                  if (row.left) lines.push(['remove', row.left]);
                  if (row.right) lines.push(['add', row.right]);
                }
                return lines.map(([kind, line]) => (
                  <div key={`${i}-${kind}`} className={`diff-row unified diff-line-${kind}`}>
                    <span className="line-num">{line.lineNum}</span>
                    <span className="line-marker">{kind === 'remove' ? '−' : kind === 'add' ? '+' : ''}</span>
                    <span className="line-content">{line.content}</span>
                  </div>
                ));
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

const FolderCompare = () => {
  const [left, setLeft] = useState({});
  const [right, setRight] = useState({});
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [filterId, setFilterId] = useState('changes');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [isMaximized, setIsMaximized] = useMaximize();
  // Latest loaded sources; loads finish asynchronously, so state closures could be stale
  const sourcesRef = useRef({ left: null, right: null });

  const runCompare = useCallback(async (l, r) => {
    setError(null);
    setSelected(null);
    setProgress({ done: 0, total: 1 });
    try {
      const res = await compareSources(l, r, { onProgress: (done, total) => setProgress({ done, total }) });
      setResults(res);
      // Open folders that contain changes
      const tree = buildTree(res);
      const open = new Set();
      const walk = (node) => {
        for (const child of node.children.values()) {
          if (!child.file && child.counts.added + child.counts.removed + child.counts.modified > 0) {
            open.add(child.path);
            walk(child);
          }
        }
      };
      walk(tree);
      setExpanded(open);
    } catch (err) {
      setError(err.message || 'Comparison failed');
    } finally {
      setProgress(null);
    }
  }, []);

  // Compare automatically once both sides are loaded
  const syncSources = (next) => {
    sourcesRef.current = next;
    setLeft(next.left ? { source: next.left } : {});
    setRight(next.right ? { source: next.right } : {});
    if (next.left && next.right) runCompare(next.left, next.right);
    else setResults(null);
  };

  const setSource = (side) => (update) => {
    if (update.loading) {
      (side === 'left' ? setLeft : setRight)({ loading: true });
      return;
    }
    if (update.error) setError(update.error);
    syncSources({ ...sourcesRef.current, [side]: update.source || null });
  };

  const filterFn = FILTERS.find((f) => f.id === filterId).match;

  const visibleResults = useMemo(() => {
    if (!results) return [];
    const q = query.trim().toLowerCase();
    return q ? results.filter((r) => r.path.toLowerCase().includes(q)) : results;
  }, [results, query]);

  const tree = useMemo(() => buildTree(visibleResults), [visibleResults]);

  const counts = useMemo(() => {
    const c = { added: 0, removed: 0, modified: 0, same: 0 };
    (results || []).forEach((r) => { c[r.status]++; });
    return c;
  }, [results]);

  const toggle = useCallback((path) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  }), []);

  const handleSwap = () => syncSources({ left: sourcesRef.current.right, right: sourcesRef.current.left });

  const handleExport = () => {
    const rows = [['path', 'status', 'original_bytes', 'modified_bytes'], ...results.map((r) => [r.path, r.status, r.left?.size ?? '', r.right?.size ?? ''])];
    const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'folder-compare.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalChanges = counts.added + counts.removed + counts.modified;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Folder & ZIP Compare"
        description="Compare two folders, sets of files or ZIP archives. Everything is read locally in your browser; click a file to see its diff."
        icon={FolderGit2}
        color="#a855f7"
      />

      <div className="fc-sources">
        <SourcePicker side="left" title="Original" source={left.source} loading={left.loading} onLoad={setSource('left')} onClear={() => setSource('left')({})} />
        <button className="btn btn-outline btn-sm fc-swap" onClick={handleSwap} title="Swap sides" disabled={!left.source && !right.source}>
          <ArrowLeftRight size={15} />
        </button>
        <SourcePicker side="right" title="Modified" source={right.source} loading={right.loading} onLoad={setSource('right')} onClear={() => setSource('right')({})} />
      </div>

      {error && (
        <div className="alert alert-error mt-4">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {progress && (
        <div className="fc-progress mt-4">
          <span>Comparing {progress.done.toLocaleString()} / {progress.total.toLocaleString()} files…</span>
          <div className="fc-progress-track"><span className="fc-progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
        </div>
      )}

      {!results && !progress && (
        <div className="util-card mt-4 empty-hint">
          <GitCompare size={22} className="mb-2" style={{ opacity: 0.6 }} /><br />
          Choose something for both sides to compare. Folders and ZIPs with a single top-level folder are aligned automatically, so <code>app-v1/</code> and <code>app-v2.zip</code> line up.
        </div>
      )}

      {results && (
        <div className={`fc-results-wrap ${isMaximized ? 'is-maximized' : ''}`}>
          <div className="tool-toolbar mt-4">
            <div className="tool-toolbar-group">
              <span className="fc-pill fc-added">+{counts.added} added</span>
              <span className="fc-pill fc-removed">−{counts.removed} removed</span>
              <span className="fc-pill fc-modified">~{counts.modified} modified</span>
              <span className="fc-pill fc-same">{counts.same} identical</span>
            </div>
            <div className="tool-toolbar-group" style={{ width: 'auto' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => runCompare(sourcesRef.current.left, sourcesRef.current.right)} title="Compare again"><RefreshCw size={15} /></button>
              <button className="btn btn-outline btn-sm" onClick={handleExport}><Download size={15} /> <span>CSV report</span></button>
              <button
                className={`btn btn-sm ${isMaximized ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setIsMaximized((v) => !v)}
                title={isMaximized ? 'Exit full view (Esc)' : 'Full view'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                <span className="hide-mobile-text">{isMaximized ? 'Exit full view' : 'Full view'}</span>
              </button>
            </div>
          </div>

          {totalChanges === 0 && (
            <div className="alert alert-success"><CheckCircle2 size={16} /> <span>Both sides have identical files ({counts.same.toLocaleString()}).</span></div>
          )}

          <div className="fc-results">
            <div className="code-panel fc-tree-panel">
              <div className="code-panel-header">
                <div className="tab-scroll">
                  <div className="segmented" role="group" aria-label="Filter">
                    {FILTERS.map((f) => (
                      <button key={f.id} type="button" className={filterId === f.id ? 'active' : ''} onClick={() => setFilterId(f.id)}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="code-panel-actions">
                  <button className="btn btn-ghost btn-xs" onClick={() => setExpanded(new Set(allDirPaths(tree)))} title="Expand all"><ChevronsUpDown size={15} /></button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setExpanded(new Set())} title="Collapse all"><ChevronsDownUp size={15} /></button>
                </div>
              </div>
              <div className="fc-search">
                <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by path…" aria-label="Filter by path" />
              </div>
              <div className="code-panel-body">
                <div className="fc-tree">
                  {[...tree.children.values()]
                    .sort((a, b) => (!!a.file - !!b.file) || a.name.localeCompare(b.name))
                    .map((child) => (
                      <TreeNode key={child.path} node={child} depth={0} expanded={expanded} toggle={toggle} selected={selected?.path} onSelect={setSelected} filter={filterFn} />
                    ))}
                  {visibleResults.filter((r) => filterFn(r.status)).length === 0 && <div className="empty-hint">Nothing matches this filter.</div>}
                </div>
              </div>
            </div>

            {selected ? <FileDiff key={selected.path} item={selected} /> : (
              <div className="code-panel fc-diff">
                <div className="code-panel-body"><div className="empty-hint">Select a file to see what changed.</div></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderCompare;
