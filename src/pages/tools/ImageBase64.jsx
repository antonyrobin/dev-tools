import React, { useState, useMemo, useEffect } from 'react';
import { FileCode2, Download, AlertTriangle } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ImageDropzone from '../../components/ImageDropzone';
import CopyButton from '../../components/CopyButton';
import { MAX_IMAGE_BYTES, formatBytes, baseName, blobToDataUrl, downloadBlob, IMAGE_FORMATS } from '../../utils/image';
import './Tools.css';
import './ImageTools.css';

const MAX_ENCODE_BYTES = 10 * 1024 * 1024;

// Recognise a raw base64 image by its magic bytes
const SIGNATURES = [
  ['iVBORw0KGgo', 'image/png'],
  ['/9j/', 'image/jpeg'],
  ['R0lGOD', 'image/gif'],
  ['UklGR', 'image/webp'],
  ['Qk', 'image/bmp'],
  ['AAABAA', 'image/x-icon'],
  ['PHN2Zy', 'image/svg+xml'],
  ['PD94bWwg', 'image/svg+xml'],
];

/** Parses a data URI or raw base64 into { mime, base64 }, or throws. */
const parseInput = (text) => {
  const trimmed = text.trim().replace(/^url\((['"]?)(.*)\1\)$/s, '$2');
  const m = trimmed.match(/^data:([\w/+.-]+)?(?:;[\w=.-]+)*;base64,(.*)$/s);
  const base64 = (m ? m[2] : trimmed).replace(/\s+/g, '');
  if (!base64) throw new Error('Paste a data URI or a base64 string.');
  if (!/^[A-Za-z0-9+/_-]+=*$/.test(base64)) throw new Error('That is not valid base64.');
  const mime = m?.[1] || SIGNATURES.find(([sig]) => base64.startsWith(sig))?.[1];
  if (!mime) throw new Error('Could not tell the image type. Paste a full data URI (data:image/png;base64,…).');
  return { mime, base64: base64.replace(/-/g, '+').replace(/_/g, '/') };
};

const ImageBase64 = () => {
  const [mode, setMode] = useState('encode');
  const [encoded, setEncoded] = useState(null); // { name, size, mime, dataUrl }
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');

  const handleFiles = async ([file]) => {
    if (file.size > MAX_ENCODE_BYTES) {
      setError(`Image is ${formatBytes(file.size)}. Base64 makes files about 33% larger, so keep embedded images under 10 MB.`);
      return;
    }
    setError(null);
    setEncoded({ name: file.name || 'image', size: file.size, mime: file.type || 'image/png', dataUrl: await blobToDataUrl(file) });
  };

  const decoded = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const { mime, base64 } = parseInput(input);
      const bin = atob(base64);
      if (bin.length > MAX_IMAGE_BYTES) throw new Error('Decoded image is larger than 50 MB.');
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return { blob: new Blob([bytes], { type: mime }), mime };
    } catch (err) {
      return { error: err.message.includes('atob') || err.name === 'InvalidCharacterError' ? 'That is not valid base64.' : err.message };
    }
  }, [input]);

  const decodedUrl = useMemo(() => (decoded?.blob ? URL.createObjectURL(decoded.blob) : null), [decoded]);
  useEffect(() => () => { if (decodedUrl) URL.revokeObjectURL(decodedUrl); }, [decodedUrl]);

  const raw = encoded ? encoded.dataUrl.slice(encoded.dataUrl.indexOf(',') + 1) : '';
  const snippets = encoded ? [
    { label: 'Data URI', value: encoded.dataUrl },
    { label: 'Base64 only', value: raw },
    { label: 'HTML <img>', value: `<img src="${encoded.dataUrl}" alt="" />` },
    { label: 'CSS background', value: `background-image: url("${encoded.dataUrl}");` },
    { label: 'Markdown', value: `![${baseName(encoded.name)}](${encoded.dataUrl})` },
  ] : [];

  const ext = (mime) => IMAGE_FORMATS.find((f) => f.mime === mime)?.ext || (mime.split('/')[1] || 'img').replace('svg+xml', 'svg');

  return (
    <div className="tool-page">
      <ToolHeader
        title="Image ↔ Base64"
        description="Turn images into data URIs and base64 for HTML, CSS, JSON or Markdown, or decode base64 back into a downloadable image."
        icon={FileCode2}
        color="#8b5cf6"
      >
        <div className="segmented" role="tablist" aria-label="Direction">
          <button type="button" role="tab" aria-selected={mode === 'encode'} className={mode === 'encode' ? 'active' : ''} onClick={() => setMode('encode')}>Image → Base64</button>
          <button type="button" role="tab" aria-selected={mode === 'decode'} className={mode === 'decode' ? 'active' : ''} onClick={() => setMode('decode')}>Base64 → Image</button>
        </div>
      </ToolHeader>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {mode === 'encode' ? (
        <div className="util-grid sidebar">
          <div className="util-stack">
            <ImageDropzone onFiles={handleFiles} className={encoded ? 'compact' : ''} hint={encoded ? 'Choose another image' : undefined} />
            {encoded && (
              <div className="util-card">
                <div className="img-frame checker" style={{ height: 220 }}><img src={encoded.dataUrl} alt={encoded.name} /></div>
                <table className="kv-table mt-2">
                  <tbody>
                    <tr><th>File</th><td>{encoded.name}</td></tr>
                    <tr><th>Type</th><td>{encoded.mime}</td></tr>
                    <tr><th>Size</th><td>{formatBytes(encoded.size)} → {formatBytes(encoded.dataUrl.length)} as data URI</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="util-stack">
            {snippets.length ? snippets.map((s) => (
              <div className="util-card" key={s.label}>
                <div className="util-card-title">
                  {s.label}
                  <CopyButton text={s.value} label="Copy" />
                </div>
                <div className="output-block" style={{ maxHeight: 120, wordBreak: 'break-all' }}>
                  {s.value.length > 4000 ? `${s.value.slice(0, 4000)}… (${s.value.length.toLocaleString()} chars, copy for the full text)` : s.value}
                </div>
              </div>
            )) : (
              <div className="util-card"><div className="empty-hint">Add an image to get its base64 and ready-to-paste snippets.</div></div>
            )}
          </div>
        </div>
      ) : (
        <div className="util-grid">
          <div className="code-panel compact">
            <div className="code-panel-header">
              <span className="code-panel-title">Base64 or data URI</span>
              <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setInput('')} disabled={!input}>Clear</button>
            </div>
            <div className="code-panel-body">
              <textarea
                className="code-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="data:image/png;base64,iVBORw0KGgo… or just the base64"
                spellCheck="false"
                style={{ flex: 1, wordBreak: 'break-all' }}
              />
            </div>
          </div>
          <div className="code-panel compact">
            <div className="code-panel-header">
              <span className="code-panel-title">Image {decoded?.blob && <span className="badge-lang">{decoded.mime}</span>}</span>
              <div className="code-panel-actions">
                {decoded?.blob && <span className="text-xs text-muted">{formatBytes(decoded.blob.size)}</span>}
                <button className="btn btn-primary btn-sm" disabled={!decoded?.blob} onClick={() => downloadBlob(decoded.blob, `image.${ext(decoded.mime)}`)}>
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
            <div className="code-panel-body" style={{ padding: '0.75rem' }}>
              {decoded?.error ? (
                <div className="inline-error"><AlertTriangle size={14} /> {decoded.error}</div>
              ) : decodedUrl ? (
                <div className="img-frame checker" style={{ height: '100%' }}><img src={decodedUrl} alt="Decoded" /></div>
              ) : (
                <div className="empty-hint">The decoded image appears here.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageBase64;
