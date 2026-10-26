import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Pause, Play, AlertTriangle } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import './Tools.css';
import './TimestampConverter.css';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
  }
})();

/** Parses epoch numbers (s / ms / µs / ns by magnitude) or any date string the browser understands. */
function parseInput(raw) {
  const text = raw.trim();
  if (!text) return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    const digits = text.replace(/^-/, '').split('.')[0].length;
    if (digits <= 11) return { date: new Date(n * 1000), unit: 'seconds' };
    if (digits <= 14) return { date: new Date(n), unit: 'milliseconds' };
    if (digits <= 17) return { date: new Date(n / 1000), unit: 'microseconds' };
    return { date: new Date(n / 1e6), unit: 'nanoseconds' };
  }
  // "2024-01-01 10:00" is not ISO; make the space a T so every browser parses it
  const normalised = /^\d{4}-\d{2}-\d{2} \d/.test(text) ? text.replace(' ', 'T') : text;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return { error: 'Could not understand that date or number' };
  return { date, unit: 'date string' };
}

const pad = (n, len = 2) => String(n).padStart(len, '0');

/** Offset like +05:30 for a date shown in the given IANA zone. */
function zoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
  return name === 'GMT' ? '+00:00' : name.replace('GMT', '');
}

/** ISO-8601 string in the given zone, e.g. 2024-01-01T15:30:00+05:30 */
function isoInZone(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const ms = date.getUTCMilliseconds();
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${ms ? `.${pad(ms, 3)}` : ''}${zoneOffset(date, timeZone)}`;
}

function relative(date) {
  const diff = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [unit, size] of units) {
    if (abs >= size || unit === 'second') return rtf.format(Math.round(diff / size), unit);
  }
  return '';
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

const toLocalInputValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const TimestampConverter = () => {
  usePageTitle('Timestamp Converter');
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [zone, setZone] = useState(LOCAL_TZ);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const parsed = useMemo(() => parseInput(input), [input]);
  const date = parsed?.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : null;

  const rows = useMemo(() => {
    if (!date) return [];
    const { week, year } = isoWeek(date);
    const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
    return [
      ['Unix seconds', String(Math.floor(date.getTime() / 1000))],
      ['Unix milliseconds', String(date.getTime())],
      ['ISO 8601 (UTC)', date.toISOString()],
      [`ISO 8601 (${zone})`, isoInZone(date, zone)],
      ['RFC 2822 / HTTP', date.toUTCString()],
      [`Readable (${zone})`, date.toLocaleString(undefined, { timeZone: zone, dateStyle: 'full', timeStyle: 'long' })],
      ['Relative', relative(date)],
      ['ISO week', `${year}-W${pad(week)}`],
      ['Day of year (UTC)', String(Math.floor((date.getTime() - startOfYear) / 86400000) + 1)],
    ];
  }, [date, zone]);

  return (
    <div className="tool-page">
      <ToolHeader
        title="Timestamp Converter"
        description="Convert Unix timestamps (seconds, milliseconds, micro- and nanoseconds) and date strings across formats and time zones."
        icon={Clock}
        color="#06b6d4"
      >
        <ShareHistory
          toolId="timestamp"
          state={{ input, zone }}
          isEmpty={(s) => !s.input.trim()}
          onRestore={(s) => { setInput(s.input || ''); if (s.zone && ZONES.includes(s.zone)) setZone(s.zone); }}
        />
      </ToolHeader>

      <div className="ts-now util-card mb-4">
        <div className="ts-now-item">
          <span className="field-label">Now · seconds</span>
          <div className="ts-now-value">
            <code>{Math.floor(now / 1000)}</code>
            <CopyButton text={String(Math.floor(now / 1000))} />
          </div>
        </div>
        <div className="ts-now-item">
          <span className="field-label">Now · milliseconds</span>
          <div className="ts-now-value">
            <code>{now}</code>
            <CopyButton text={String(now)} />
          </div>
        </div>
        <div className="ts-now-item">
          <span className="field-label">Now · ISO</span>
          <div className="ts-now-value">
            <code className="ts-iso">{new Date(now).toISOString()}</code>
          </div>
        </div>
        <div className="ts-now-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setPaused((p) => !p)} title={paused ? 'Resume clock' : 'Pause clock'}>
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Use now</button>
        </div>
      </div>

      <div className="util-grid sidebar">
        <div className="util-stack">
          <div className="util-card">
            <label className="field mb-4">
              <span>Timestamp or date</span>
              <input
                className="form-input mono-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="1700000000, 1700000000000 or 2024-05-01T12:00:00Z"
                spellCheck="false"
              />
            </label>
            {parsed?.unit && <div className="text-xs text-muted mb-4">Detected: <strong>{parsed.unit}</strong></div>}
            {parsed?.error && <div className="inline-error mb-4"><AlertTriangle size={15} /> {parsed.error}</div>}

            <label className="field mb-4">
              <span>Pick a local date &amp; time</span>
              <input
                className="form-input"
                type="datetime-local"
                step="1"
                value={date ? toLocalInputValue(date) : ''}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!Number.isNaN(d.getTime())) setInput(String(Math.floor(d.getTime() / 1000)));
                }}
              />
            </label>

            <label className="field">
              <span>Display time zone</span>
              <select className="form-select" value={zone} onChange={(e) => setZone(e.target.value)}>
                {ZONES.map((z) => <option key={z} value={z}>{z}{z === LOCAL_TZ ? ' (local)' : ''}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="util-card">
          <div className="util-card-title">Conversions</div>
          {date ? (
            <div className="table-scroll">
              <table className="kv-table stack-mobile">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                      <td className="kv-copy"><CopyButton text={value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-hint">Enter a timestamp or date to convert it.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimestampConverter;
