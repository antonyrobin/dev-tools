import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Binary, ArrowDownUp, Trash2, AlertTriangle, FileUp } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import './Tools.css';

// ---- Codecs ----

const bytesToBase64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const base64ToBytes = (b64) => {
  // Accepts standard and URL-safe alphabets, with or without padding
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) throw new Error('Input contains characters that are not valid Base64');
  if (clean.length % 4 === 1) throw new Error('Invalid Base64 length');
  const bin = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const HTML_NAMED = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const CODECS = {
  base64: {
    label: 'Base64',
    encode: (text, opts) => {
      let out = bytesToBase64(new TextEncoder().encode(text));
      if (opts.urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (opts.wrap) out = out.replace(/(.{76})/g, '$1\n').trim();
      return out;
    },
    decode: (text) => {
      const bytes = base64ToBytes(text);
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return decoded;
    },
  },
  url: {
    label: 'URL',
    encode: (text, opts) => (opts.fullUri ? encodeURI(text) : encodeURIComponent(text)),
    decode: (text, opts) => {
      const input = opts.plusAsSpace ? text.replace(/\+/g, ' ') : text;
      try {
        return decodeURIComponent(input);
      } catch {
        throw new Error('Malformed percent-encoding (a % is not followed by two hex digits)');
      }
    },
  },
  html: {
    label: 'HTML entities',
    encode: (text, opts) => {
      let out = text.replace(/[&<>"']/g, (c) => HTML_NAMED[c]);
      if (opts.nonAscii) out = out.replace(/[^\x20-\x7e\t\n\r]/gu, (c) => `&#${c.codePointAt(0)};`);
      return out;
    },
    decode: (text) => {
      // A detached <textarea> decodes every named/numeric entity without running any markup
      const ta = document.createElement('textarea');
      ta.innerHTML = text;
      return ta.value;
    },
  },
};

const TABS = Object.entries(CODECS).map(([id, c]) => ({ id, label: c.label }));

const UrlBreakdown = ({ text }) => {
  const url = useMemo(() => {
    try {
      const u = new URL(text.trim());
      return /^https?:|^ftp:|^wss?:/.test(u.protocol) ? u : null;
    } catch {
      return null;
    }
  }, [text]);
  if (!url) return null;
  const params = [...url.searchParams.entries()];
  return (
    <div className="util-card mt-4">
      <div className="util-card-title">URL breakdown</div>
      <div className="table-scroll">
        <table className="kv-table stack-mobile">
          <tbody>
            <tr><th>Protocol</th><td>{url.protocol}</td><td className="kv-copy" /></tr>
            <tr><th>Host</th><td>{url.host}</td><td className="kv-copy"><CopyButton text={url.host} /></td></tr>
            <tr><th>Path</th><td>{decodeURIComponent(url.pathname)}</td><td className="kv-copy"><CopyButton text={url.pathname} /></td></tr>
            {url.hash && <tr><th>Fragment</th><td>{url.hash}</td><td className="kv-copy"><CopyButton text={url.hash} /></td></tr>}
            {params.map(([k, v], i) => (
              <tr key={`${k}-${i}`}><th>?{k}</th><td>{v}</td><td className="kv-copy"><CopyButton text={v} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Encoder = () => {
  usePageTitle('Encoder / Decoder');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = CODECS[searchParams.get('tab')] ? searchParams.get('tab') : 'base64';
  const [mode, setMode] = useState('encode');
  const [input, setInput] = useState('Hello, wörld! 👋 <tag attr="1"> & more');
  const [opts, setOpts] = useState({ urlSafe: false, wrap: false, fullUri: false, plusAsSpace: true, nonAscii: false });
  const [fileName, setFileName] = useState('');

  const setTab = (id) => setSearchParams({ tab: id }, { replace: true });
  const setOpt = (key) => (e) => setOpts((o) => ({ ...o, [key]: e.target.checked }));

  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: null };
    try {
      return { output: CODECS[tab][mode](input, opts), error: null };
    } catch (err) {
      return { output: '', error: err.message };
    }
  }, [tab, mode, input, opts]);

  const handleSwap = () => {
    setInput(output);
    setMode((m) => (m === 'encode' ? 'decode' : 'encode'));
    setFileName('');
  };

  // Files are encoded byte-for-byte to Base64 (e.g. for data URIs)
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Please choose a file under 10 MB.');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setTab('base64');
    setMode('decode');
    setInput(bytesToBase64(bytes));
    setFileName(`${file.name} · data:${file.type || 'application/octet-stream'};base64,…`);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="Encoder / Decoder"
        description="Base64, URL percent-encoding and HTML entities. Unicode-safe, live as you type."
        icon={Binary}
        color="#f97316"
      >
        <ShareHistory
          toolId="encode"
          state={{ tab, mode, input }}
          isEmpty={(s) => !s.input}
          describe={(s) => `${CODECS[s.tab]?.label || s.tab} ${s.mode} · ${s.input.slice(0, 60)}`}
          onRestore={(s) => { if (CODECS[s.tab]) setTab(s.tab); if (s.mode) setMode(s.mode); setInput(s.input || ''); }}
        />
      </ToolHeader>

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <div className="tab-scroll">
            <div className="segmented" role="tablist" aria-label="Encoding">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="segmented" role="group" aria-label="Direction">
            <button type="button" className={mode === 'encode' ? 'active' : ''} onClick={() => setMode('encode')}>Encode</button>
            <button type="button" className={mode === 'decode' ? 'active' : ''} onClick={() => setMode('decode')}>Decode</button>
          </div>
        </div>
        <div className="tool-toolbar-group" style={{ width: 'auto' }}>
          {tab === 'base64' && mode === 'encode' && (
            <>
              <label className="check-toggle"><input type="checkbox" checked={opts.urlSafe} onChange={setOpt('urlSafe')} /><span>URL-safe</span></label>
              <label className="check-toggle"><input type="checkbox" checked={opts.wrap} onChange={setOpt('wrap')} /><span>Wrap at 76</span></label>
            </>
          )}
          {tab === 'base64' && (
            <label className="btn btn-outline btn-sm" title="Encode any file to Base64">
              <FileUp size={15} /> <span>File → Base64</span>
              <input type="file" hidden onChange={handleFile} />
            </label>
          )}
          {tab === 'url' && mode === 'encode' && (
            <label className="check-toggle" title="encodeURI keeps :/?#&= so a whole URL stays usable">
              <input type="checkbox" checked={opts.fullUri} onChange={setOpt('fullUri')} /><span>Whole URL (encodeURI)</span>
            </label>
          )}
          {tab === 'url' && mode === 'decode' && (
            <label className="check-toggle"><input type="checkbox" checked={opts.plusAsSpace} onChange={setOpt('plusAsSpace')} /><span>+ as space</span></label>
          )}
          {tab === 'html' && mode === 'encode' && (
            <label className="check-toggle"><input type="checkbox" checked={opts.nonAscii} onChange={setOpt('nonAscii')} /><span>Encode non-ASCII</span></label>
          )}
        </div>
      </div>

      <div className="util-grid">
        <div className="code-panel compact">
          <div className="code-panel-header">
            <span className="code-panel-title">{mode === 'encode' ? 'Plain text' : `${CODECS[tab].label} input`}</span>
            <div className="code-panel-actions">
              {fileName && <span className="text-xs text-muted truncate" style={{ maxWidth: 220 }} title={fileName}>{fileName}</span>}
              <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => { setInput(''); setFileName(''); }} disabled={!input} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <textarea className="code-textarea" style={{ flex: 1 }} value={input} onChange={(e) => { setInput(e.target.value); setFileName(''); }} placeholder="Type or paste text…" spellCheck="false" />
          </div>
          <div className="code-panel-footer">
            <span>{input.length.toLocaleString()} chars</span>
            <span>{new TextEncoder().encode(input).length.toLocaleString()} bytes</span>
          </div>
        </div>

        <div className="code-panel compact">
          <div className="code-panel-header">
            <span className="code-panel-title">{mode === 'encode' ? `${CODECS[tab].label} output` : 'Decoded text'}</span>
            <div className="code-panel-actions">
              <button className="btn btn-ghost btn-xs" onClick={handleSwap} disabled={!output} title="Use output as input and flip direction">
                <ArrowDownUp size={14} /><span className="hide-mobile-text">Swap</span>
              </button>
              <CopyButton text={output} />
            </div>
          </div>
          <div className="code-panel-body">
            {error ? (
              <div className="inline-error p-4"><AlertTriangle size={15} /> {error}</div>
            ) : (
              <textarea className="code-textarea" style={{ flex: 1 }} value={output} readOnly placeholder="Result appears here…" spellCheck="false" />
            )}
          </div>
          <div className="code-panel-footer">
            <span>{output.length.toLocaleString()} chars</span>
            <span>{input && output ? `${Math.round((output.length / input.length) * 100)}% of input` : ''}</span>
          </div>
        </div>
      </div>

      {tab === 'url' && <UrlBreakdown text={mode === 'decode' ? output || input : input} />}
    </div>
  );
};

export default Encoder;
