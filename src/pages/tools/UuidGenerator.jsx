import React, { useState, useMemo } from 'react';
import { Fingerprint, RefreshCw, Download, Search } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import CopyButton from '../../components/CopyButton';
import './Tools.css';

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const format36 = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

const uuidV4 = () => (crypto.randomUUID ? crypto.randomUUID() : (() => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format36(hex(b));
})());

// RFC 9562 v7: 48-bit Unix ms timestamp + random bits; sorts by creation time.
// A per-millisecond counter in rand_a keeps ids generated in one batch strictly increasing.
let lastMs = 0;
let seq = 0;
const uuidV7 = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ms = Date.now();
  if (ms <= lastMs) {
    seq++;
    if (seq > 0xfff) { lastMs++; seq = 0; }
    ms = lastMs;
  } else {
    lastMs = ms;
    seq = b[7] & 0x3f; // random start leaves room to count up
  }
  for (let i = 5; i >= 0; i--) { b[i] = ms % 256; ms = Math.floor(ms / 256); }
  b[6] = 0x70 | ((seq >> 8) & 0x0f);
  b[7] = seq & 0xff;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format36(hex(b));
};

const VERSIONS = [
  { id: 'v4', label: 'v4 · random', make: uuidV4 },
  { id: 'v7', label: 'v7 · time-ordered', make: uuidV7 },
  { id: 'nil', label: 'Nil', make: () => '00000000-0000-0000-0000-000000000000' },
];

const UUID_RE = /^[{(]?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})[)}]?$/i;

function inspectUuid(text) {
  const m = text.trim().replace(/^urn:uuid:/i, '').match(UUID_RE);
  if (!m) return null;
  const h = m.slice(1).join('').toLowerCase();
  const version = parseInt(h[12], 16);
  const variantBits = parseInt(h[16], 16);
  const variant = variantBits >= 0xe ? 'Reserved (future)' : variantBits >= 0xc ? 'Microsoft (legacy)' : variantBits >= 0x8 ? 'RFC 9562 / 4122' : 'NCS (legacy)';
  const info = { canonical: format36(h), version, variant };
  if (h === '0'.repeat(32)) info.note = 'Nil UUID';
  else if (h === 'f'.repeat(32)) info.note = 'Max UUID';
  if (version === 7) info.time = new Date(parseInt(h.slice(0, 12), 16));
  if (version === 1) {
    // 60-bit count of 100 ns intervals since 1582-10-15
    const ts = BigInt(`0x${h.slice(13, 16)}${h.slice(8, 12)}${h.slice(0, 8)}`);
    info.time = new Date(Number((ts - 122192928000000000n) / 10000n));
  }
  return info;
}

const UuidGenerator = () => {
  const [version, setVersion] = useState('v4');
  const [count, setCount] = useState(10);
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  // Bumped by "Generate" to produce a fresh batch with the same options
  const [seed, setSeed] = useState(0);
  const [inspect, setInspect] = useState('');

  const raw = useMemo(() => {
    void seed;
    const make = VERSIONS.find((v) => v.id === version).make;
    return Array.from({ length: Math.min(Math.max(1, count || 1), 10000) }, make);
  }, [version, count, seed]);

  const list = useMemo(() => raw.map((u) => {
    let s = hyphens ? u : u.replace(/-/g, '');
    if (upper) s = s.toUpperCase();
    return braces ? `{${s}}` : s;
  }), [raw, upper, hyphens, braces]);

  const all = list.join('\n');
  const info = inspect.trim() ? inspectUuid(inspect) : null;

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([all], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `uuids-${version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="UUID Generator"
        description="Generate random v4 or time-ordered v7 UUIDs in bulk using the browser's secure random generator, and inspect existing UUIDs."
        icon={Fingerprint}
        color="#22c55e"
      />

      <div className="util-grid sidebar">
        <div className="util-stack">
          <div className="util-card">
            <div className="util-card-title">Options</div>
            <div className="field mb-4">
              <span>Version</span>
              <div className="segmented" role="group" aria-label="UUID version" style={{ flexWrap: 'wrap' }}>
                {VERSIONS.map((v) => (
                  <button key={v.id} type="button" className={version === v.id ? 'active' : ''} onClick={() => setVersion(v.id)}>{v.label}</button>
                ))}
              </div>
            </div>
            <label className="field mb-4">
              <span>How many (max 10,000)</span>
              <input className="form-input" type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            <div className="chip-row mb-4">
              <label className="check-toggle"><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /><span>Uppercase</span></label>
              <label className="check-toggle"><input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /><span>Hyphens</span></label>
              <label className="check-toggle"><input type="checkbox" checked={braces} onChange={(e) => setBraces(e.target.checked)} /><span>{'{Braces}'}</span></label>
            </div>
            <button className="btn btn-primary w-full" onClick={() => setSeed((n) => n + 1)}>
              <RefreshCw size={16} /> Generate
            </button>
          </div>

          <div className="util-card">
            <div className="util-card-title"><span className="flex items-center gap-2"><Search size={15} /> Inspect a UUID</span></div>
            <input
              className="form-input mono-input"
              value={inspect}
              onChange={(e) => setInspect(e.target.value)}
              placeholder="Paste a UUID…"
              spellCheck="false"
            />
            {inspect.trim() && !info && <div className="inline-error mt-2">Not a valid UUID.</div>}
            {info && (
              <table className="kv-table mt-2">
                <tbody>
                  <tr><th>Version</th><td>{info.note || `v${info.version}`}</td></tr>
                  <tr><th>Variant</th><td>{info.variant}</td></tr>
                  {info.time && !Number.isNaN(info.time.getTime()) && <tr><th>Created</th><td>{info.time.toISOString()}</td></tr>}
                  <tr><th>Canonical</th><td>{info.canonical}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Generated <span className="badge-lang">{list.length.toLocaleString()}</span></span>
            <div className="code-panel-actions">
              <CopyButton text={all} label="Copy all" />
              <button className="btn btn-ghost btn-xs" onClick={handleDownload} disabled={!all} title="Download .txt"><Download size={14} /></button>
            </div>
          </div>
          <div className="code-panel-body">
            <textarea className="code-textarea" style={{ flex: 1 }} value={all} readOnly spellCheck="false" aria-label="Generated UUIDs" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UuidGenerator;
