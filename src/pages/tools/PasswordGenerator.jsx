import React, { useState, useMemo } from 'react';
import { Lock, RefreshCw, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import { randomInt, pick, shuffle } from '../../utils/random';
import './Tools.css';
import './PasswordGenerator.css';

const SETS = {
  upper: { label: 'A–Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  lower: { label: 'a–z', chars: 'abcdefghijklmnopqrstuvwxyz' },
  digits: { label: '0–9', chars: '0123456789' },
  symbols: { label: '!@#$', chars: '!@#$%^&*()-_=+[]{};:,.<>/?~' },
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

function strengthOf(bits) {
  if (bits < 40) return { label: 'Weak', tone: 'bad', icon: ShieldAlert };
  if (bits < 64) return { label: 'Fair', tone: 'warn', icon: Shield };
  if (bits < 100) return { label: 'Strong', tone: 'ok', icon: ShieldCheck };
  return { label: 'Very strong', tone: 'ok', icon: ShieldCheck };
}

// Rough offline cracking time at 10^10 guesses per second
function crackTime(bits) {
  const seconds = 2 ** bits / 2 / 1e10;
  if (seconds < 1) return 'instantly';
  const units = [['years', 31557600], ['days', 86400], ['hours', 3600], ['minutes', 60], ['seconds', 1]];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const v = seconds / size;
      if (name === 'years' && v > 1e6) return `${v.toExponential(1)} years`;
      return `${Math.round(v).toLocaleString()} ${name}`;
    }
  }
  return 'instantly';
}

const PasswordGenerator = () => {
  usePageTitle('Password Generator');
  const [length, setLength] = useState(20);
  const [enabled, setEnabled] = useState({ upper: true, lower: true, digits: true, symbols: true });
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);
  const [exclude, setExclude] = useState('');
  const [count, setCount] = useState(5);
  const [seed, setSeed] = useState(0);

  const pools = useMemo(() => Object.entries(enabled)
    .filter(([, on]) => on)
    .map(([key]) => {
      let chars = SETS[key].chars;
      if (avoidAmbiguous) chars = chars.replace(AMBIGUOUS, '');
      if (exclude) chars = [...chars].filter((c) => !exclude.includes(c)).join('');
      return chars;
    })
    .filter(Boolean), [enabled, avoidAmbiguous, exclude]);

  const alphabet = pools.join('');

  const passwords = useMemo(() => {
    void seed;
    if (!alphabet) return [];
    const make = () => {
      // One character from each enabled class, the rest from the whole alphabet, then shuffle
      const chars = pools.slice(0, length).map(pick);
      while (chars.length < length) chars.push(alphabet[randomInt(alphabet.length)]);
      return shuffle(chars).join('');
    };
    return Array.from({ length: Math.min(Math.max(count, 1), 50) }, make);
  }, [alphabet, pools, length, count, seed]);

  const bits = alphabet ? length * Math.log2(alphabet.length) : 0;
  const strength = strengthOf(bits);

  return (
    <div className="tool-page">
      <ToolHeader
        title="Password Generator"
        description="Strong random passwords from your browser's cryptographic random generator. Nothing is stored or sent anywhere."
        icon={Lock}
        color="#eab308"
      />

      <div className="util-grid sidebar">
        <div className="util-card">
          <div className="util-card-title">Options</div>
          <label className="field mb-4">
            <span>Length: {length}</span>
            <input className="range-input" type="range" min={4} max={128} value={length} onChange={(e) => setLength(Number(e.target.value))} />
          </label>
          <div className="field mb-4">
            <span>Characters</span>
            <div className="chip-row">
              {Object.entries(SETS).map(([key, set]) => (
                <label key={key} className="check-toggle">
                  <input
                    type="checkbox"
                    checked={enabled[key]}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span className="font-mono">{set.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="check-toggle mb-4">
            <input type="checkbox" checked={avoidAmbiguous} onChange={(e) => setAvoidAmbiguous(e.target.checked)} />
            <span>Avoid look-alikes (I l 1 O 0)</span>
          </label>
          <label className="field mb-4">
            <span>Exclude characters</span>
            <input className="form-input mono-input" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="e.g. {}[]" spellCheck="false" />
          </label>
          <label className="field mb-4">
            <span>How many</span>
            <input className="form-input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary w-full" onClick={() => setSeed((n) => n + 1)} disabled={!alphabet}>
            <RefreshCw size={16} /> Regenerate
          </button>
        </div>

        <div className="util-stack">
          <div className="util-card">
            <div className="util-card-title">
              <span>Strength</span>
              <span className={`status-badge ${strength.tone}`}><strength.icon size={13} /> {strength.label}</span>
            </div>
            <div className="pw-meter" aria-hidden="true">
              <span className={`pw-meter-fill ${strength.tone}`} style={{ width: `${Math.min(100, (bits / 128) * 100)}%` }} />
            </div>
            <p className="text-sm text-muted mt-2 mb-0">
              {alphabet
                ? <>≈ {Math.round(bits)} bits of entropy from {alphabet.length} possible characters. Brute force at 10 billion guesses/s: about {crackTime(bits)}.</>
                : 'Select at least one character set.'}
            </p>
          </div>

          <div className="util-card">
            <div className="util-card-title">
              <span>Passwords</span>
              <CopyButton text={passwords.join('\n')} label="Copy all" />
            </div>
            <ul className="pw-list">
              {passwords.map((pw, i) => (
                <li key={`${i}-${pw}`}>
                  <code className="pw-value">{pw}</code>
                  <CopyButton text={pw} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;
