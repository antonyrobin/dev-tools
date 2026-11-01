import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import CopyButton from '../components/CopyButton';
import MaximizeButton from '../components/MaximizeButton';
import useMaximize from '../hooks/useMaximize';
import { COMPILER_LANGUAGES, LANGUAGE_BY_EXT } from '../data/compilerLanguages';
import { fetchCompilers, compilersFor, runRemote } from '../utils/wandbox';
import { Cpu, Play, Square, Trash2, RotateCcw, Globe, Monitor, AlertTriangle, RefreshCw } from 'lucide-react';

const LOCAL = 'local';
const DRAFTS_KEY = 'devtools-compiler-drafts';
const LANG_KEY = 'devtools-compiler-language';

const readStorage = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable: drafts just won't persist */ }
};

// Forwards console output from the sandboxed HTML preview to the page
const CONSOLE_BRIDGE = `<script>(function(){
  var fmt=function(a){if(typeof a==='string')return a;if(a instanceof Error)return a.name+': '+a.message;try{return JSON.stringify(a,null,2)}catch(e){return String(a)}};
  var send=function(level,args){parent.postMessage({__devtoolsConsole:true,level:level,text:Array.prototype.map.call(args,fmt).join(' ')},'*')};
  ['log','info','warn','error','debug'].forEach(function(m){var o=console[m];console[m]=function(){send(m==='debug'?'log':m,arguments);o.apply(console,arguments)}});
  addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});
  addEventListener('unhandledrejection',function(e){send('error',['Uncaught (in promise)',e.reason])});
})();</script>`;

const withBridge = (html) => (/<head[^>]*>/i.test(html)
  ? html.replace(/<head[^>]*>/i, (m) => m + CONSOLE_BRIDGE)
  : CONSOLE_BRIDGE + html);

/** Turns a Wandbox result into console lines. */
const remoteLines = (r) => {
  const lines = [];
  if (r.compiler_message) lines.push({ level: 'compiler', text: r.compiler_message.replace(/\n$/, '') });
  if (r.program_output) lines.push({ level: 'log', text: r.program_output.replace(/\n$/, '') });
  if (r.program_error) lines.push({ level: 'error', text: r.program_error.replace(/\n$/, '') });
  if (!lines.length) lines.push({ level: 'info', text: 'Program finished with no output.' });
  return lines;
};

const CodeCompiler = () => {
  const [langId, setLangId] = useState(() => {
    const saved = readStorage(LANG_KEY, 'javascript');
    return COMPILER_LANGUAGES.some((l) => l.id === saved) ? saved : 'javascript';
  });
  const lang = COMPILER_LANGUAGES.find((l) => l.id === langId);
  const [drafts, setDrafts] = useState(() => readStorage(DRAFTS_KEY, {}));
  const code = drafts[langId] ?? lang.template;

  const [stdin, setStdin] = useState('');
  const [flags, setFlags] = useState('');
  const [outputTab, setOutputTab] = useState('output');
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState(null); // { ms, exit, signal }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [maxPanel, setMaxPanel] = useMaximize();

  // Remote compiler list
  const [allCompilers, setAllCompilers] = useState(null);
  const [listError, setListError] = useState(null);
  const [compilerByLang, setCompilerByLang] = useState({});

  const workerRef = useRef(null);
  const abortRef = useRef(null);
  const iframeRef = useRef(null);

  const isRemoteLanguage = lang.engine === 'remote';
  const versions = useMemo(
    () => (allCompilers && lang.wandbox ? compilersFor(allCompilers, lang.wandbox, lang.prefer) : []),
    [allCompilers, lang]
  );
  const defaultCompiler = lang.engine === 'remote' ? versions[0]?.name || '' : LOCAL;
  const selectedCompiler = compilerByLang[langId] ?? defaultCompiler;
  const runsRemotely = lang.engine === 'remote' || (lang.engine === 'browser' && selectedCompiler !== LOCAL);
  const compiler = runsRemotely ? versions.find((c) => c.name === selectedCompiler) : null;

  const loadCompilers = useCallback(() => {
    setListError(null);
    fetchCompilers()
      .then(setAllCompilers)
      .catch(() => setListError('Could not load the compiler list from wandbox.org. Remote languages need an internet connection.'));
  }, []);

  // Fetch the version list once a language that can use it is selected
  useEffect(() => {
    if (lang.wandbox && !allCompilers) loadCompilers();
  }, [lang, allCompilers, loadCompilers]);

  useEffect(() => writeStorage(LANG_KEY, langId), [langId]);
  useEffect(() => {
    const id = setTimeout(() => writeStorage(DRAFTS_KEY, drafts), 400);
    return () => clearTimeout(id);
  }, [drafts]);

  const setCode = (value) => setDrafts((d) => ({ ...d, [langId]: value }));

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  // Console messages from the HTML preview
  useEffect(() => {
    const onMessage = (e) => {
      if (!e.data?.__devtoolsConsole || e.source !== iframeRef.current?.contentWindow) return;
      setLogs((prev) => [...prev, { level: e.data.level, text: String(e.data.text) }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const runLocalJs = () => {
    const worker = new Worker(new URL('../utils/jsRunner.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.type === 'log') {
        setLogs((prev) => [...prev, { level: data.level, text: data.text }]);
      } else if (data.type === 'done') {
        setStatus({ ms: data.ms });
        setRunning(false);
        // Keep the worker alive so pending timers can still log; the next run replaces it
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      setLogs((prev) => [...prev, { level: 'error', text: e.message || 'Script error' }]);
      setRunning(false);
    };
    worker.postMessage({ code });
  };

  const runRemoteCode = async () => {
    if (!compiler) {
      setError(listError || 'The compiler list is still loading. Try again in a moment.');
      setRunning(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    try {
      const result = await runRemote({ compiler, code, stdin, compilerFlags: flags, signal: controller.signal });
      setLogs(remoteLines(result));
      setStatus({ ms: performance.now() - start, exit: result.status, signal: result.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        setLogs([{ level: 'info', text: 'Stopped.' }]);
      } else {
        setError(`Could not run the code on wandbox.org: ${err.message}. Check your internet connection and try again.`);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  };

  const run = () => {
    stop();
    setError(null);
    setLogs([]);
    setStatus(null);
    setOutputTab('output');
    if (lang.engine === 'html') {
      // A fresh key on the iframe reloads it even when the document is unchanged
      setPreviewDoc({ html: withBridge(code), key: Date.now() });
      return;
    }
    setRunning(true);
    if (runsRemotely) runRemoteCode();
    else runLocalJs();
  };

  // Ctrl/Cmd+Enter runs the code
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const switchLanguage = (id) => {
    if (id === langId) return;
    stop();
    setLangId(id);
    setLogs([]);
    setStatus(null);
    setError(null);
    setPreviewDoc(null);
    setOutputTab('output');
  };

  const clearOutput = () => {
    setLogs([]);
    setStatus(null);
    setPreviewDoc(null);
  };

  const togglePanel = (id) => setMaxPanel((v) => (v === id ? false : id));
  const outputText = logs.map((l) => l.text).join('\n');
  const showStdin = runsRemotely;
  const ok = status && (status.exit === undefined || String(status.exit) === '0') && !status.signal;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Code Compiler"
        description="Write, compile and run code in 30 languages. JavaScript and HTML run locally in your browser; other languages run on the free Wandbox compiler service. Press Ctrl+Enter to run."
        icon={Cpu}
        color="var(--success)"
      />

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <select className="form-select" value={langId} onChange={(e) => switchLanguage(e.target.value)} aria-label="Language">
            {COMPILER_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          {lang.engine !== 'html' && (
            <select
              className="form-select"
              value={selectedCompiler}
              onChange={(e) => setCompilerByLang((m) => ({ ...m, [langId]: e.target.value }))}
              aria-label="Compiler version"
              disabled={isRemoteLanguage && !versions.length}
            >
              {lang.engine === 'browser' && <option value={LOCAL}>Browser (local)</option>}
              {isRemoteLanguage && !versions.length && <option value="">{listError ? 'Unavailable' : 'Loading versions…'}</option>}
              {versions.map((c) => (
                <option key={c.name} value={c.name}>{lang.engine === 'browser' ? 'Node.js ' : ''}{c['display-name'] && lang.engine !== 'browser' ? `${c['display-name']} ` : ''}{c.version}</option>
              ))}
            </select>
          )}
          {runsRemotely && (
            <input
              className="form-input mono-input compiler-flags"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="Extra compiler flags, e.g. -O2"
              aria-label="Extra compiler flags"
              spellCheck="false"
            />
          )}
        </div>
        {running ? (
          <button className="btn btn-outline" onClick={stop} title="Stop">
            <Square size={16} /> <span>Stop</span>
          </button>
        ) : (
          <button className="btn btn-primary" onClick={run} title="Run (Ctrl+Enter)" disabled={runsRemotely && !compiler}>
            <Play size={16} /> <span>Run</span>
          </button>
        )}
      </div>

      <div className={`compiler-notice ${runsRemotely ? 'remote' : ''}`}>
        {runsRemotely ? <Globe size={14} /> : <Monitor size={14} />}
        <span>
          {runsRemotely
            ? 'This language runs on wandbox.org: your code and input are sent there to be compiled. Don\'t paste secrets.'
            : lang.engine === 'html'
              ? 'Rendered locally in a sandboxed frame. Nothing leaves your browser.'
              : 'Runs locally in a background worker (no DOM access). Nothing leaves your browser.'}
        </span>
        {listError && lang.wandbox && (
          <button className="btn btn-ghost btn-xs" onClick={loadCompilers}><RefreshCw size={13} /> Retry</button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="editor-split">
        <div className={`code-panel ${maxPanel === 'input' ? 'is-maximized' : ''}`}>
          <div className="code-panel-header">
            <span className="code-panel-title">Code <span className="badge-lang">{lang.label}</span></span>
            <div className="code-panel-actions">
              <UploadButton
                label="Upload"
                className="btn btn-ghost btn-xs"
                onFileLoaded={(res) => {
                  const id = LANGUAGE_BY_EXT[res.extension];
                  if (id && id !== langId) switchLanguage(id);
                  setDrafts((d) => ({ ...d, [id || langId]: res.content }));
                }}
                onError={setError}
              />
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setDrafts((d) => { const next = { ...d }; delete next[langId]; return next; })}
                disabled={code === lang.template}
                title="Reset to the example"
              >
                <RotateCcw size={14} />
              </button>
              <MaximizeButton active={maxPanel === 'input'} onToggle={() => togglePanel('input')} />
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={code}
              onChange={setCode}
              onFileLoaded={(res) => {
                const id = LANGUAGE_BY_EXT[res.extension];
                if (id && id !== langId) {
                  switchLanguage(id);
                  setDrafts((d) => ({ ...d, [id]: res.content }));
                }
              }}
              placeholder="Write or drop a source file..."
              lineNumbers
            />
          </div>
          <div className="code-panel-footer">
            <span>{code.split('\n').length.toLocaleString()} lines</span>
            <span>Ctrl+Enter to run</span>
          </div>
        </div>

        <div className={`code-panel ${maxPanel === 'output' ? 'is-maximized' : ''}`}>
          <div className="code-panel-header">
            {showStdin ? (
              <div className="segmented" role="tablist" aria-label="Output or input">
                <button type="button" role="tab" aria-selected={outputTab === 'output'} className={outputTab === 'output' ? 'active' : ''} onClick={() => setOutputTab('output')}>Output</button>
                <button type="button" role="tab" aria-selected={outputTab === 'stdin'} className={outputTab === 'stdin' ? 'active' : ''} onClick={() => setOutputTab('stdin')}>
                  Input (stdin){stdin && ' •'}
                </button>
              </div>
            ) : (
              <span className="code-panel-title">{lang.engine === 'html' ? 'Preview' : 'Console'}</span>
            )}
            <div className="code-panel-actions">
              {running && <span className="text-xs text-muted"><RefreshCw size={12} className="animate-spin" /> Running…</span>}
              {status && (
                <span className={`status-badge ${ok ? 'ok' : 'bad'}`}>
                  {status.signal ? status.signal : status.exit !== undefined ? `exit ${status.exit}` : 'done'} · {status.ms < 1000 ? `${status.ms.toFixed(0)} ms` : `${(status.ms / 1000).toFixed(2)} s`}
                </span>
              )}
              <CopyButton text={outputText} title="Copy output" />
              <button className="btn btn-ghost btn-xs" onClick={clearOutput} title="Clear output" disabled={!logs.length && !status && !previewDoc}>
                <Trash2 size={14} />
              </button>
              <MaximizeButton active={maxPanel === 'output'} onToggle={() => togglePanel('output')} />
            </div>
          </div>

          {showStdin && outputTab === 'stdin' ? (
            <div className="code-panel-body">
              <CodeDropzoneTextarea
                value={stdin}
                onChange={setStdin}
                placeholder="Text your program reads from standard input, one value per line…"
              />
            </div>
          ) : lang.engine === 'html' ? (
            <div className="code-panel-body compiler-preview">
              {previewDoc ? (
                <iframe
                  key={previewDoc.key}
                  ref={iframeRef}
                  title="HTML preview"
                  className="compiler-iframe"
                  sandbox="allow-scripts allow-modals allow-forms"
                  srcDoc={previewDoc.html}
                />
              ) : (
                <div className="empty-hint">Press Run to render the page.</div>
              )}
              {logs.length > 0 && (
                <div className="console-output compiler-preview-console">
                  {logs.map((l, i) => <div key={i} className={`console-line console-${l.level}`}>{l.text}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div className="code-panel-body console-output">
              {logs.length === 0 ? (
                <span className="text-muted">{running ? 'Waiting for output…' : 'No output yet. Run your code!'}</span>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`console-line console-${l.level}`}>{l.text}</div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .compiler-flags { width: 220px; padding: 0.45rem 0.8rem; font-size: 0.85rem; }
        .compiler-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .compiler-notice.remote { color: var(--warning-text); }
        .compiler-notice span { flex: 1; min-width: 0; }
        .console-output {
          overflow: auto;
          padding: 0.5rem 0;
          font-family: var(--font-mono);
          font-size: var(--code-font-size);
          line-height: var(--code-line-height);
        }
        .console-output > .text-muted { padding: 0.25rem 0.9rem; }
        .console-line {
          white-space: pre-wrap;
          word-break: break-word;
          padding: 0.15rem 0.9rem;
          border-bottom: 1px solid rgb(var(--fg-rgb) / 0.04);
        }
        .console-warn { color: var(--warning-text); background: rgba(245, 158, 11, 0.08); }
        .console-error { color: var(--danger-text); background: rgba(239, 68, 68, 0.08); }
        .console-info { color: var(--info-text); }
        .console-compiler { color: var(--text-muted); background: rgb(var(--fg-rgb) / 0.03); }
        .compiler-preview { background: #fff; }
        .compiler-preview .empty-hint { color: #6b7280; }
        .compiler-iframe { flex: 1; min-height: 0; width: 100%; border: none; background: #fff; }
        .compiler-preview-console {
          flex: 0 0 auto;
          max-height: 35%;
          background: var(--bg-code);
          border-top: 1px solid var(--border-light);
        }
        @media (max-width: 600px) {
          .compiler-flags { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default CodeCompiler;
