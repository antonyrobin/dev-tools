import React, { useState, useMemo, useEffect } from 'react';
import { KeyRound, AlertTriangle, ShieldCheck, ShieldX, Trash2, Sparkles } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import './Tools.css';
import './JwtDecoder.css';

// Demo token signed with HS256 and the secret "your-256-bit-secret"
const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const CLAIM_NAMES = {
  iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expires', nbf: 'Not before', iat: 'Issued at',
  jti: 'JWT ID', name: 'Full name', email: 'Email', scope: 'Scope', azp: 'Authorized party', nonce: 'Nonce',
};
const TIME_CLAIMS = ['exp', 'nbf', 'iat', 'auth_time', 'updated_at'];

const b64urlToBytes = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const decodePart = (part, label) => {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
  } catch {
    throw new Error(`The ${label} is not valid Base64url-encoded JSON`);
  }
};

const relative = (seconds) => {
  const diff = seconds - Date.now() / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
};

// ---- Signature verification (Web Crypto) ----

const pemToDer = (pem) => {
  const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
};

const ALGS = {
  HS256: { kind: 'hmac', hash: 'SHA-256' }, HS384: { kind: 'hmac', hash: 'SHA-384' }, HS512: { kind: 'hmac', hash: 'SHA-512' },
  RS256: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  RS384: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
  RS512: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
  PS384: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 },
  PS512: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
  ES256: { kind: 'ec', namedCurve: 'P-256', hash: 'SHA-256' },
  ES384: { kind: 'ec', namedCurve: 'P-384', hash: 'SHA-384' },
  ES512: { kind: 'ec', namedCurve: 'P-521', hash: 'SHA-512' },
};

async function verifySignature(token, alg, keyText, secretIsBase64) {
  const spec = ALGS[alg];
  if (!spec) throw new Error(`Algorithm ${alg} is not supported for verification`);
  const [h, p, s] = token.split('.');
  const data = new TextEncoder().encode(`${h}.${p}`);
  const signature = b64urlToBytes(s);

  if (spec.kind === 'hmac') {
    const raw = secretIsBase64 ? b64urlToBytes(keyText.trim()) : new TextEncoder().encode(keyText);
    const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: spec.hash }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, signature, data);
  }
  if (!/-----BEGIN PUBLIC KEY-----/.test(keyText)) throw new Error('Paste a PEM public key (-----BEGIN PUBLIC KEY-----)');
  const der = pemToDer(keyText);
  if (spec.kind === 'rsa') {
    const key = await crypto.subtle.importKey('spki', der, { name: spec.name, hash: spec.hash }, false, ['verify']);
    return crypto.subtle.verify(spec.name === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: spec.saltLength } : spec.name, key, signature, data);
  }
  const key = await crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: spec.namedCurve }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: spec.hash }, key, signature, data);
}

const JsonBlock = ({ title, value, tone }) => {
  const text = JSON.stringify(value, null, 2);
  return (
    <div className={`util-card jwt-part jwt-${tone}`}>
      <div className="util-card-title">
        <span>{title}</span>
        <CopyButton text={text} />
      </div>
      <pre className="output-block">{text}</pre>
    </div>
  );
};

const JwtDecoder = () => {
  usePageTitle('JWT Decoder');
  const [token, setToken] = useState(SAMPLE_TOKEN);
  const [keyText, setKeyText] = useState('');
  const [secretIsBase64, setSecretIsBase64] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  // Current time for expiry badges, refreshed every 30 s
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 30000);
    return () => clearInterval(t);
  }, []);

  const trimmed = token.trim().replace(/^Bearer\s+/i, '');

  const decoded = useMemo(() => {
    if (!trimmed) return null;
    const parts = trimmed.split('.');
    if (parts.length === 5) return { error: 'This looks like an encrypted JWE (5 parts). Only signed JWS tokens can be decoded without the key.' };
    if (parts.length !== 3) return { error: `A JWT has 3 dot-separated parts; this has ${parts.length}.` };
    try {
      return { header: decodePart(parts[0], 'header'), payload: decodePart(parts[1], 'payload'), signature: parts[2] };
    } catch (err) {
      return { error: err.message };
    }
  }, [trimmed]);

  const alg = decoded?.header?.alg;
  const isHmac = /^HS/.test(alg || '');

  // A result only counts for the exact token + key it was computed for
  const verifyKey = `${trimmed}\n${keyText}\n${secretIsBase64}`;
  useEffect(() => {
    if (!decoded?.header || !keyText.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      verifySignature(trimmed, alg, keyText, secretIsBase64)
        .then((ok) => !cancelled && setVerifyResult({ key: verifyKey, ok }))
        .catch((err) => !cancelled && setVerifyResult({ key: verifyKey, error: err.message || 'Verification failed' }));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [decoded, trimmed, alg, keyText, secretIsBase64, verifyKey]);
  const verified = verifyResult?.key === verifyKey && keyText.trim() ? verifyResult : null;

  const payload = decoded?.payload;
  const expired = typeof payload?.exp === 'number' && payload.exp < now;
  const notYet = typeof payload?.nbf === 'number' && payload.nbf > now;

  return (
    <div className="tool-page">
      <ToolHeader
        title="JWT Decoder"
        description="Decode JSON Web Tokens, read their claims and expiry, and verify signatures. Tokens and keys never leave your browser."
        icon={KeyRound}
        color="#e11d48"
      >
        <ShareHistory
          toolId="jwt"
          state={{ token }}
          isEmpty={(s) => !s.token.trim()}
          onRestore={(s) => setToken(s.token || '')}
        />
      </ToolHeader>

      <div className="util-grid">
        <div className="util-stack">
          <div className="code-panel compact">
            <div className="code-panel-header">
              <span className="code-panel-title">Encoded token</span>
              <div className="code-panel-actions">
                <button className="btn btn-ghost btn-xs" onClick={() => setToken(SAMPLE_TOKEN)} title="Load sample"><Sparkles size={14} /></button>
                <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setToken('')} disabled={!token} title="Clear"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="code-panel-body">
              <textarea
                className="code-textarea jwt-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste a JWT (with or without “Bearer ”)…"
                spellCheck="false"
              />
            </div>
          </div>

          {decoded && !decoded.error && (
            <div className="jwt-colored output-block" aria-label="Token parts">
              {trimmed.split('.').map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="jwt-dot">.</span>}
                  <span className={`jwt-seg-${i}`}>{part}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {decoded?.header && (
            <div className="util-card">
              <div className="util-card-title">
                <span>Verify signature</span>
                {verified?.ok === true && <span className="status-badge ok"><ShieldCheck size={13} /> Signature verified</span>}
                {verified?.ok === false && <span className="status-badge bad"><ShieldX size={13} /> Invalid signature</span>}
              </div>
              {alg === 'none' ? (
                <p className="text-sm text-warning mb-0">This token uses <code>alg: none</code> and is not signed — never trust it.</p>
              ) : (
                <>
                  <textarea
                    className="form-input mono-input"
                    rows={isHmac ? 2 : 5}
                    value={keyText}
                    onChange={(e) => setKeyText(e.target.value)}
                    placeholder={isHmac ? `Shared secret for ${alg}` : `PEM public key for ${alg || 'this token'}\n-----BEGIN PUBLIC KEY-----\n…`}
                    spellCheck="false"
                    style={{ resize: 'vertical' }}
                  />
                  {isHmac && (
                    <label className="check-toggle mt-2">
                      <input type="checkbox" checked={secretIsBase64} onChange={(e) => setSecretIsBase64(e.target.checked)} />
                      <span>Secret is Base64 encoded</span>
                    </label>
                  )}
                  {verified?.error && <div className="inline-error mt-2"><AlertTriangle size={15} /> {verified.error}</div>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="util-stack">
          {!decoded && <div className="util-card empty-hint">Paste a token to decode it.</div>}
          {decoded?.error && <div className="alert alert-error mb-0"><AlertTriangle size={16} /> <span>{decoded.error}</span></div>}
          {decoded?.header && (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="status-badge info">alg: {alg || '—'}</span>
                {decoded.header.typ && <span className="status-badge info">typ: {decoded.header.typ}</span>}
                {typeof payload?.exp === 'number' && (
                  expired
                    ? <span className="status-badge bad">Expired {relative(payload.exp)}</span>
                    : <span className="status-badge ok">Valid · expires {relative(payload.exp)}</span>
                )}
                {notYet && <span className="status-badge warn">Not valid until {relative(payload.nbf)}</span>}
                {payload && payload.exp === undefined && <span className="status-badge warn">No expiry</span>}
              </div>

              <JsonBlock title="Header" value={decoded.header} tone="header" />
              <JsonBlock title="Payload" value={payload} tone="payload" />

              {payload && typeof payload === 'object' && (
                <div className="util-card">
                  <div className="util-card-title">Claims</div>
                  <div className="table-scroll">
                    <table className="kv-table stack-mobile">
                      <tbody>
                        {Object.entries(payload).map(([k, v]) => (
                          <tr key={k}>
                            <th title={k}>{CLAIM_NAMES[k] ? `${CLAIM_NAMES[k]} (${k})` : k}</th>
                            <td>
                              {TIME_CLAIMS.includes(k) && typeof v === 'number'
                                ? <>{new Date(v * 1000).toLocaleString()} <span className="text-muted">· {relative(v)}</span></>
                                : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JwtDecoder;
