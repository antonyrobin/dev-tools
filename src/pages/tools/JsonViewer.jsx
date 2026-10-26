import React, { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from 'react';
import JSON5 from 'json5';
import { JSONPath } from 'jsonpath-plus';
import { ListTree, ChevronRight, ChevronDown, ChevronsUpDown, ChevronsDownUp, Sparkles, Trash2, AlertTriangle, Search } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import CodeDropzoneTextarea, { UploadButton } from '../../components/CodeDropzoneTextarea';
import usePageTitle from '../../hooks/usePageTitle';
import './Tools.css';
import './JsonViewer.css';

const SAMPLE = `{
  "store": {
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95, "inStock": true, "dealer": null }
  }
}`;

const QUERY_EXAMPLES = ['$.store.book[*].author', '$..price', '$.store.book[?(@.price < 10)]', '$..book[-1:]', '$..book.length'];

const PAGE_SIZE = 100;
const IDENT = /^[A-Za-z_$][\w$]*$/;

const childPath = (parent, key) =>
  typeof key === 'number' ? `${parent}[${key}]` : IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Every container path down to the given depth (used for the initial and "expand all" states). */
function collectPaths(value, path, depth, out, limit = 5000) {
  if (out.size >= limit || value === null || typeof value !== 'object') return out;
  if (depth <= 0) return out;
  out.add(path);
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
  for (const [k, v] of entries) collectPaths(v, childPath(path, k), depth - 1, out, limit);
  return out;
}

const Primitive = ({ value }) => {
  const t = typeOf(value);
  const text = t === 'string' ? JSON.stringify(value) : String(value);
  return <span className={`jv-val jv-${t}`}>{text}</span>;
};

const JsonNode = React.memo(({ name, value, path, depth, expanded, toggle, selected, onSelect, limits, showMore }) => {
  const t = typeOf(value);
  const isContainer = t === 'object' || t === 'array';
  const open = isContainer && expanded.has(path);
  const entries = isContainer ? (t === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value)) : [];
  const limit = limits[path] || PAGE_SIZE;

  return (
    <div className="jv-node">
      <div
        className={`jv-row ${selected === path ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        data-path={path}
        onClick={() => onSelect(path)}
      >
        {isContainer ? (
          <button
            type="button"
            className="jv-toggle"
            onClick={(e) => { e.stopPropagation(); toggle(path); }}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="jv-toggle-spacer" />}
        {name !== undefined && (
          <span className={typeof name === 'number' ? 'jv-index' : 'jv-key'}>
            {typeof name === 'number' ? name : JSON.stringify(name)}
            <span className="jv-colon">:</span>
          </span>
        )}
        {isContainer ? (
          <span className="jv-summary">
            {t === 'array' ? `[ ${entries.length} item${entries.length === 1 ? '' : 's'} ]` : `{ ${entries.length} key${entries.length === 1 ? '' : 's'} }`}
          </span>
        ) : <Primitive value={value} />}
      </div>
      {open && (
        <>
          {entries.slice(0, limit).map(([k, v]) => (
            <JsonNode
              key={k}
              name={k}
              value={v}
              path={childPath(path, k)}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
              limits={limits}
              showMore={showMore}
            />
          ))}
          {entries.length > limit && (
            <button type="button" className="jv-more" style={{ marginLeft: `${(depth + 1) * 16 + 24}px` }} onClick={() => showMore(path)}>
              Show {Math.min(PAGE_SIZE, entries.length - limit)} more of {entries.length - limit} remaining…
            </button>
          )}
        </>
      )}
    </div>
  );
});

/** Converts a JSON Pointer from jsonpath-plus into this viewer's path notation. */
const pointerToPath = (pointer, root) => {
  let path = '$';
  let node = root;
  for (const raw of pointer.split('/').slice(1)) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    const key = Array.isArray(node) ? Number(seg) : seg;
    path = childPath(path, key);
    node = node?.[key];
  }
  return path;
};

/** Walks from the root to `path`, returning the container paths on the way and the value found. */
const walkTo = (path, root) => {
  const ancestors = ['$'];
  let current = '$';
  let node = root;
  while (current !== path) {
    if (!node || typeof node !== 'object') return { ancestors, value: undefined };
    const entries = Array.isArray(node) ? node.map((v, i) => [i, v]) : Object.entries(node);
    const next = entries.find(([k]) => {
      const p = childPath(current, k);
      return path === p || path.startsWith(p + '.') || path.startsWith(p + '[');
    });
    if (!next) return { ancestors, value: undefined };
    current = childPath(current, next[0]);
    node = next[1];
    ancestors.push(current);
  }
  return { ancestors, value: node };
};

const JsonViewer = () => {
  usePageTitle('JSON Tree Viewer');
  const [input, setInput] = useState(SAMPLE);
  const [query, setQuery] = useState('$.store.book[?(@.price < 10)].title');
  const [selected, setSelected] = useState('$');
  const [limits, setLimits] = useState({});
  const treeRef = useRef(null);

  const deferred = useDeferredValue(input);
  const { data, error } = useMemo(() => {
    if (!deferred.trim()) return { data: undefined, error: null };
    try {
      return { data: JSON.parse(deferred), error: null };
    } catch (err) {
      try { return { data: JSON5.parse(deferred), error: null }; } catch { return { data: undefined, error: err.message }; }
    }
  }, [deferred]);

  const [expanded, setExpanded] = useState(() => new Set(['$']));

  // New document: expand the first two levels and reset the selection
  useEffect(() => {
    setExpanded(data === undefined ? new Set() : collectPaths(data, '$', 2, new Set()));
    setSelected('$');
    setLimits({});
  }, [data]);

  const toggle = useCallback((path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const showMore = useCallback((path) => setLimits((prev) => ({ ...prev, [path]: (prev[path] || PAGE_SIZE) + PAGE_SIZE })), []);

  const reveal = useCallback((path) => {
    setExpanded((prev) => new Set([...prev, ...walkTo(path, data).ancestors.slice(0, -1)]));
    setSelected(path);
    requestAnimationFrame(() => {
      const row = treeRef.current?.querySelector(`[data-path="${CSS.escape(path)}"]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [data]);

  const queryResult = useMemo(() => {
    if (data === undefined || !query.trim()) return null;
    try {
      const results = JSONPath({ path: query.trim(), json: data, resultType: 'all', wrap: true });
      return { results: results.map((r) => ({ path: pointerToPath(r.pointer, data), value: r.value })) };
    } catch (err) {
      return { error: err.message };
    }
  }, [data, query]);

  const selectedValue = data === undefined ? undefined : walkTo(selected, data).value;
  const selectedJson = selectedValue === undefined ? '' : JSON.stringify(selectedValue, null, 2);

  return (
    <div className="tool-page">
      <ToolHeader
        title="JSON Tree Viewer"
        description="Browse JSON as a collapsible tree, click any node to get its path, and query with JSONPath."
        icon={ListTree}
        color="#14b8a6"
      >
        <ShareHistory
          toolId="json-viewer"
          state={{ input, query }}
          isEmpty={(s) => !s.input.trim()}
          onRestore={(s) => { setInput(s.input || ''); if (s.query !== undefined) setQuery(s.query); }}
        />
      </ToolHeader>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>Invalid JSON: {error}</span>
        </div>
      )}

      <div className="editor-split split-2-3">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">JSON <span className="badge-lang">INPUT</span></span>
            <div className="code-panel-actions">
              <button className="btn btn-ghost btn-xs" onClick={() => setInput(SAMPLE)} title="Load sample"><Sparkles size={14} /></button>
              <UploadButton label="Upload" className="btn btn-ghost btn-xs" onFileLoaded={(res) => setInput(res.content)} />
              <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setInput('')} disabled={!input} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea value={input} onChange={setInput} placeholder="Paste or drop JSON here…" lineNumbers />
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Tree</span>
            <div className="code-panel-actions">
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => data !== undefined && setExpanded(collectPaths(data, '$', Infinity, new Set()))}
                title="Expand all (first 5,000 nodes)"
                disabled={data === undefined}
              >
                <ChevronsUpDown size={15} /><span className="hide-mobile-text">Expand</span>
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setExpanded(new Set(['$']))} title="Collapse all" disabled={data === undefined}>
                <ChevronsDownUp size={15} /><span className="hide-mobile-text">Collapse</span>
              </button>
            </div>
          </div>
          <div className="jv-pathbar">
            <code className="jv-path" title={selected}>{selected}</code>
            <CopyButton text={selected} title="Copy path" />
            <CopyButton text={selectedJson} title="Copy value as JSON" label="Value" />
          </div>
          <div className="code-panel-body">
            <div className="jv-tree" ref={treeRef} tabIndex={0}>
              {data === undefined ? (
                <div className="empty-hint">{error ? 'Fix the JSON to see the tree.' : 'Paste JSON on the left to explore it.'}</div>
              ) : (
                <JsonNode
                  value={data}
                  path="$"
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selected={selected}
                  onSelect={setSelected}
                  limits={limits}
                  showMore={showMore}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="util-card mt-4">
        <div className="util-card-title">
          <span className="flex items-center gap-2"><Search size={15} /> JSONPath query</span>
          {queryResult?.results && <span className="status-badge info">{queryResult.results.length} result{queryResult.results.length === 1 ? '' : 's'}</span>}
        </div>
        <input
          className="form-input mono-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="$.store.book[*].title"
          aria-label="JSONPath query"
          spellCheck="false"
        />
        <div className="chip-row mt-2">
          {QUERY_EXAMPLES.map((q) => (
            <button key={q} type="button" className={`chip font-mono ${query === q ? 'active' : ''}`} onClick={() => setQuery(q)}>{q}</button>
          ))}
        </div>

        {queryResult?.error && <div className="inline-error mt-3"><AlertTriangle size={15} /> {queryResult.error}</div>}
        {queryResult?.results && (
          queryResult.results.length === 0 ? (
            <div className="empty-hint">No matches.</div>
          ) : (
            <div className="jv-results mt-3">
              <div className="flex justify-end mb-2">
                <CopyButton text={() => JSON.stringify(queryResult.results.map((r) => r.value), null, 2)} label="Copy all values" className="btn btn-ghost btn-xs" />
              </div>
              {queryResult.results.slice(0, 500).map((r) => (
                <div key={r.path} className="jv-result">
                  <button type="button" className="jv-result-path" onClick={() => reveal(r.path)} title="Show in tree">{r.path}</button>
                  <pre className="jv-result-value">{JSON.stringify(r.value, null, 2)}</pre>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default JsonViewer;
