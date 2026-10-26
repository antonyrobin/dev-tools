import React, { useState, useMemo, useDeferredValue } from 'react';
import JSON5 from 'json5';
import { Braces, Download, Trash2, Sparkles, AlertTriangle } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import CodeDropzoneTextarea, { UploadButton } from '../../components/CodeDropzoneTextarea';
import usePageTitle from '../../hooks/usePageTitle';
import { jsonToTypeScript } from '../../utils/jsonToTs';
import './Tools.css';

const SAMPLE = `{
  "id": 42,
  "username": "octocat",
  "email": null,
  "verified": true,
  "profile": { "bio": "Builder", "links": ["https://github.com"] },
  "repos": [
    { "name": "hello-world", "stars": 120, "topics": ["demo"] },
    { "name": "dev-tools", "stars": 3400, "license": "MIT", "topics": [] }
  ],
  "created-at": "2024-02-01T10:00:00Z"
}`;

const JsonToTs = () => {
  usePageTitle('JSON to TypeScript');
  const [input, setInput] = useState(SAMPLE);
  const [rootName, setRootName] = useState('Root');
  const [useType, setUseType] = useState(false);
  const [optionalNull, setOptionalNull] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [exportDecl, setExportDecl] = useState(true);

  const deferred = useDeferredValue(input);

  const { output, error } = useMemo(() => {
    if (!deferred.trim()) return { output: '', error: null };
    let value;
    try {
      value = JSON.parse(deferred);
    } catch (err) {
      try { value = JSON5.parse(deferred); } catch { return { output: '', error: err.message }; }
    }
    return {
      output: jsonToTypeScript(value, { rootName: rootName.trim() || 'Root', useType, optionalNull, readonly, exportDecl }),
      error: null,
    };
  }, [deferred, rootName, useType, optionalNull, readonly, exportDecl]);

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rootName || 'types'}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="JSON to TypeScript"
        description="Paste a JSON sample to get TypeScript interfaces. Arrays are merged, so keys missing in some items become optional."
        icon={Braces}
        color="#2563eb"
      >
        <ShareHistory
          toolId="json-to-ts"
          state={{ input, rootName }}
          isEmpty={(s) => !s.input.trim()}
          onRestore={(s) => { setInput(s.input || ''); if (s.rootName) setRootName(s.rootName); }}
        />
      </ToolHeader>

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <input
            className="form-input mono-input"
            style={{ width: 160, padding: '0.45rem 0.7rem' }}
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            aria-label="Root type name"
            title="Root type name"
            placeholder="Root"
          />
          <div className="segmented" role="group" aria-label="Declaration style">
            <button type="button" className={!useType ? 'active' : ''} onClick={() => setUseType(false)}>interface</button>
            <button type="button" className={useType ? 'active' : ''} onClick={() => setUseType(true)}>type</button>
          </div>
          <label className="check-toggle" title="Fields that are null become optional instead of `| null`">
            <input type="checkbox" checked={optionalNull} onChange={(e) => setOptionalNull(e.target.checked)} />
            <span>null → optional</span>
          </label>
          <label className="check-toggle">
            <input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} />
            <span>readonly</span>
          </label>
          <label className="check-toggle">
            <input type="checkbox" checked={exportDecl} onChange={(e) => setExportDecl(e.target.checked)} />
            <span>export</span>
          </label>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setInput(SAMPLE)}>
          <Sparkles size={15} /> <span>Sample</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>Invalid JSON: {error}</span>
        </div>
      )}

      <div className="editor-split">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">JSON <span className="badge-lang">INPUT</span></span>
            <div className="code-panel-actions">
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
            <span className="code-panel-title">TypeScript <span className="badge-lang">.TS</span></span>
            <div className="code-panel-actions">
              <CopyButton text={output} />
              <button className="btn btn-ghost btn-xs" onClick={handleDownload} disabled={!output} title="Download .ts">
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea value={output} readOnly placeholder="Generated types appear here…" lineNumbers />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonToTs;
