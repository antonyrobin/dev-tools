import React, { useState, useEffect, useRef } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { Cpu, Play, Trash2 } from 'lucide-react';

const formatArg = (a) => {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  try {
    return JSON.stringify(a, null, 2);
  } catch {
    return String(a);
  }
};

const CodeCompiler = () => {
  const [code, setCode] = useState('// Write your JS code here\nconsole.log("Hello, World!");\nconsole.table?.([{ a: 1 }]);\nconsole.warn("Warnings are highlighted");\n');
  const [logs, setLogs] = useState([]);
  const [duration, setDuration] = useState(null);

  const runCode = async () => {
    const captured = [];
    const methods = ['log', 'info', 'warn', 'error', 'debug', 'table'];
    const original = {};
    methods.forEach((m) => {
      original[m] = console[m];
      console[m] = (...args) => captured.push({ level: m === 'table' || m === 'debug' ? 'log' : m, text: args.map(formatArg).join(' ') });
    });

    const start = performance.now();
    try {
      // Async wrapper so top-level await works in snippets
      const func = new Function(`return (async () => {\n${code}\n})();`);
      await func();
    } catch (err) {
      captured.push({ level: 'error', text: `${err.name || 'Error'}: ${err.message}` });
    } finally {
      methods.forEach((m) => { console[m] = original[m]; });
    }
    setDuration(performance.now() - start);
    setLogs(captured.length ? captured : [{ level: 'info', text: 'Execution complete with no output.' }]);
  };

  // Ctrl/Cmd+Enter runs the code
  const runRef = useRef(runCode);
  runRef.current = runCode;
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

  return (
    <div className="tool-page">
      <ToolHeader
        title="JS Runner"
        description="Run JavaScript snippets in your browser (top-level await supported). Press Ctrl+Enter to run."
        icon={Cpu}
        color="var(--success)"
      />

      <div className="editor-split">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Input <span className="badge-lang">JS</span></span>
            <div className="code-panel-actions">
              <UploadButton label="Upload" className="btn btn-ghost btn-xs" onFileLoaded={(res) => setCode(res.content)} />
              <button className="btn btn-primary btn-sm" onClick={runCode} title="Run (Ctrl+Enter)">
                <Play size={15} /> Run
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={code}
              onChange={setCode}
              placeholder="Paste or drag & drop JS code file..."
              lineNumbers
            />
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Console</span>
            <div className="code-panel-actions">
              {duration !== null && <span className="text-xs text-muted">{duration.toFixed(1)} ms</span>}
              <button className="btn btn-ghost btn-xs" onClick={() => { setLogs([]); setDuration(null); }} title="Clear console">
                <Trash2 size={15} /> Clear
              </button>
            </div>
          </div>
          <div className="code-panel-body console-output">
            {logs.length === 0 ? (
              <span className="text-muted">No output yet. Run your code!</span>
            ) : (
              logs.map((l, i) => (
                <div key={i} className={`console-line console-${l.level}`}>{l.text}</div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
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
      `}</style>
    </div>
  );
};

export default CodeCompiler;
