import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { Zap, Copy, Check, Download, Trash2, AlertTriangle } from 'lucide-react';
import { minifyCode } from '../utils/minify';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: 'min.js' },
  { value: 'css', label: 'CSS', ext: 'min.css' },
  { value: 'html', label: 'HTML', ext: 'min.html' },
  { value: 'json', label: 'JSON', ext: 'min.json' },
];

const EXT_TO_LANG = { js: 'javascript', jsx: 'javascript', ts: 'javascript', mjs: 'javascript', css: 'css', html: 'html', htm: 'html', json: 'json' };

const byteSize = (s) => new Blob([s]).size;
const formatBytes = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

const CodeMinifier = () => {
  const [language, setLanguage] = useState('javascript');
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const handleMinify = () => {
    setError(null);
    try {
      setOutputCode(minifyCode(inputCode, language));
    } catch (err) {
      setOutputCode('');
      setError(`Could not minify: ${err.message}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = LANGUAGES.find(l => l.value === language)?.ext || 'min.txt';
    const url = URL.createObjectURL(new Blob([outputCode], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `output.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inSize = byteSize(inputCode);
  const outSize = byteSize(outputCode);
  const saved = inSize > 0 && outputCode ? Math.max(0, Math.round((1 - outSize / inSize) * 100)) : 0;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Code Minifier"
        description="Compress JavaScript, CSS, HTML or JSON. Strings, URLs and regex literals are left untouched."
        icon={Zap}
        color="var(--secondary)"
      />

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <UploadButton
            label="Upload"
            className="btn btn-outline btn-sm"
            onFileLoaded={(res) => {
              setInputCode(res.content);
              if (EXT_TO_LANG[res.extension]) setLanguage(EXT_TO_LANG[res.extension]);
            }}
            onError={setError}
          />
          <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={() => { setInputCode(''); setOutputCode(''); }} disabled={!inputCode && !outputCode}>
            <Trash2 size={15} /> <span>Clear</span>
          </button>
        </div>
        <button className="btn btn-secondary" onClick={handleMinify} disabled={!inputCode}>
          <Zap size={16} /> <span>Minify</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="editor-split">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Original</span>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={inputCode}
              onChange={setInputCode}
              onFileLoaded={(res) => { if (EXT_TO_LANG[res.extension]) setLanguage(EXT_TO_LANG[res.extension]); }}
              placeholder="Paste or drag & drop source code file..."
              lineNumbers
            />
          </div>
          <div className="code-panel-footer">
            <span>{formatBytes(inSize)}</span>
            <span>{inputCode ? inputCode.split('\n').length : 0} lines</span>
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">
              Minified
              {outputCode && <span className="badge-lang" style={{ color: '#34d399', background: 'rgba(16,185,129,0.15)' }}>−{saved}%</span>}
            </span>
            <div className="code-panel-actions">
              <button className="btn btn-ghost btn-xs" onClick={handleCopy} disabled={!outputCode} title="Copy">
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
              </button>
              <button className="btn btn-ghost btn-xs" onClick={handleDownload} disabled={!outputCode} title="Download">
                <Download size={15} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <textarea
              className="code-textarea"
              readOnly
              value={outputCode}
              placeholder="Minified output will appear here..."
              style={{ flex: 1, wordBreak: 'break-all' }}
            />
          </div>
          <div className="code-panel-footer">
            <span>{formatBytes(outSize)}</span>
            <span>{outputCode ? `saved ${formatBytes(Math.max(0, inSize - outSize))}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeMinifier;
