import React, { useState, useEffect, useMemo } from 'react';
import SparkMD5 from 'spark-md5';
import { Hash, FileUp, X, CheckCircle2 } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import './Tools.css';

const ALGORITHMS = [
  { id: 'MD5', subtle: null, note: 'Not collision-resistant — checksums only' },
  { id: 'SHA-1', subtle: 'SHA-1', note: 'Deprecated for signatures' },
  { id: 'SHA-256', subtle: 'SHA-256' },
  { id: 'SHA-384', subtle: 'SHA-384' },
  { id: 'SHA-512', subtle: 'SHA-512' },
];

const MAX_FILE_BYTES = 512 * 1024 * 1024;

const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const hexToBase64 = (hex) => btoa(hex.match(/.{2}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join(''));

// HMAC-MD5 per RFC 2104 (Web Crypto has no MD5)
function hmacMd5(keyBytes, dataBytes) {
  const block = 64;
  let key = keyBytes;
  if (key.length > block) key = new Uint8Array(SparkMD5.ArrayBuffer.hash(key.buffer, true).split('').map((c) => c.charCodeAt(0)));
  const k = new Uint8Array(block);
  k.set(key);
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  const inner = new SparkMD5.ArrayBuffer();
  inner.append(ipad.buffer);
  inner.append(dataBytes.buffer.slice(dataBytes.byteOffset, dataBytes.byteOffset + dataBytes.byteLength));
  const innerRaw = inner.end(true);
  const outer = new SparkMD5.ArrayBuffer();
  outer.append(opad.buffer);
  outer.append(Uint8Array.from(innerRaw, (c) => c.charCodeAt(0)).buffer);
  return outer.end();
}

async function computeHashes(bytes, hmacKey) {
  const out = {};
  const keyBytes = hmacKey ? new TextEncoder().encode(hmacKey) : null;
  for (const alg of ALGORITHMS) {
    if (!alg.subtle) {
      out[alg.id] = keyBytes ? hmacMd5(keyBytes, bytes) : SparkMD5.ArrayBuffer.hash(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    } else if (keyBytes) {
      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: alg.subtle }, false, ['sign']);
      out[alg.id] = toHex(await crypto.subtle.sign('HMAC', key, bytes));
    } else {
      out[alg.id] = toHex(await crypto.subtle.digest(alg.subtle, bytes));
    }
  }
  return out;
}

const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

const HashGenerator = () => {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog');
  const [file, setFile] = useState(null); // { name, size, bytes }
  const [useHmac, setUseHmac] = useState(false);
  const [hmacKey, setHmacKey] = useState('');
  const [upper, setUpper] = useState(false);
  const [base64, setBase64] = useState(false);
  const [expected, setExpected] = useState('');
  const [computed, setComputed] = useState({ inputs: null, hashes: {}, error: null });
  const [fileError, setFileError] = useState(null);

  const inputs = useMemo(() => ({ text, file, key: useHmac ? hmacKey : null }), [text, file, useHmac, hmacKey]);
  const waitingForKey = useHmac && !hmacKey;

  useEffect(() => {
    if (waitingForKey) return;
    let cancelled = false;
    const bytes = inputs.file ? inputs.file.bytes : new TextEncoder().encode(inputs.text);
    const t = setTimeout(() => {
      computeHashes(bytes, inputs.key)
        .then((res) => !cancelled && setComputed({ inputs, hashes: res, error: null }))
        .catch((err) => !cancelled && setComputed({ inputs, hashes: {}, error: err.message || 'Hashing failed (Web Crypto needs HTTPS)' }));
    }, inputs.file ? 0 : 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [inputs, waitingForKey]);

  const hashes = waitingForKey ? {} : computed.hashes;
  const busy = !waitingForKey && computed.inputs !== inputs;
  const error = fileError || computed.error;

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setFileError(`File is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setFileError(null);
    setFile({ name: f.name, size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) });
  };

  const display = (hex) => {
    if (!hex) return '';
    if (base64) return hexToBase64(hex);
    return upper ? hex.toUpperCase() : hex;
  };

  const expectedNorm = expected.trim().toLowerCase();
  const matchId = expectedNorm && ALGORITHMS.find((a) => hashes[a.id] && (hashes[a.id] === expectedNorm || hexToBase64(hashes[a.id]).toLowerCase() === expectedNorm))?.id;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Hash Generator"
        description="MD5, SHA-1, SHA-256, SHA-384 and SHA-512 for text or files, with optional HMAC and checksum matching."
        icon={Hash}
        color="#84cc16"
      >
        {/* Only text is shared or kept in history; HMAC keys never are */}
        <ShareHistory
          toolId="hash"
          state={{ text: file ? '' : text }}
          isEmpty={(s) => !s.text}
          onRestore={(s) => { setFile(null); setText(s.text || ''); }}
        />
      </ToolHeader>

      <div className="util-grid">
        <div className="util-stack">
          <div className="code-panel compact">
            <div className="code-panel-header">
              <span className="code-panel-title">{file ? 'File' : 'Text'}</span>
              <div className="code-panel-actions">
                <label className="btn btn-ghost btn-xs" title="Hash a file instead of text">
                  <FileUp size={14} /><span>File</span>
                  <input type="file" hidden onChange={handleFile} />
                </label>
              </div>
            </div>
            <div className="code-panel-body">
              {file ? (
                <div className="empty-hint flex flex-col items-center gap-2">
                  <FileUp size={28} className="text-primary" />
                  <strong className="text-sm" style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => setFile(null)}><X size={14} /> Back to text</button>
                </div>
              ) : (
                <textarea className="code-textarea" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text to hash…" spellCheck="false" />
              )}
            </div>
            <div className="code-panel-footer">
              <span>{file ? formatBytes(file.size) : `${new TextEncoder().encode(text).length.toLocaleString()} bytes (UTF-8)`}</span>
              <span>{busy ? 'Hashing…' : ''}</span>
            </div>
          </div>

          <div className="util-card">
            <div className="chip-row mb-2">
              <label className="check-toggle"><input type="checkbox" checked={useHmac} onChange={(e) => setUseHmac(e.target.checked)} /><span>HMAC</span></label>
              <label className="check-toggle"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} disabled={base64} /><span>Uppercase</span></label>
              <label className="check-toggle"><input type="checkbox" checked={base64} onChange={(e) => setBase64(e.target.checked)} /><span>Base64 output</span></label>
            </div>
            {useHmac && (
              <input
                className="form-input mono-input mb-2"
                type="text"
                value={hmacKey}
                onChange={(e) => setHmacKey(e.target.value)}
                placeholder="HMAC secret key"
                autoComplete="off"
                spellCheck="false"
              />
            )}
            <input
              className="form-input mono-input"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Paste an expected hash to verify a checksum…"
              spellCheck="false"
            />
            {expectedNorm && (
              <div className="mt-2">
                {matchId
                  ? <span className="status-badge ok"><CheckCircle2 size={13} /> Matches {matchId}</span>
                  : <span className="status-badge bad">No algorithm matches</span>}
              </div>
            )}
          </div>
        </div>

        <div className="util-card">
          <div className="util-card-title">
            <span>{useHmac ? 'HMAC digests' : 'Digests'}</span>
          </div>
          {error && <div className="inline-error mb-2">{error}</div>}
          {waitingForKey && <div className="text-sm text-muted mb-2">Enter a secret key to compute HMACs.</div>}
          <div className="table-scroll">
            <table className="kv-table stack-mobile">
              <tbody>
                {ALGORITHMS.map((a) => (
                  <tr key={a.id} style={matchId === a.id ? { background: 'rgba(16, 185, 129, 0.08)' } : undefined}>
                    <th title={a.note}>{useHmac ? `HMAC-${a.id}` : a.id}{a.note && <div className="text-xs text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>{a.note}</div>}</th>
                    <td>{display(hashes[a.id])}</td>
                    <td className="kv-copy"><CopyButton text={display(hashes[a.id])} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashGenerator;
