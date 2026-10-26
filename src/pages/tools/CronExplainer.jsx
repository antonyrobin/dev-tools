import React, { useState, useMemo } from 'react';
import cronstrue from 'cronstrue';
import { CalendarClock, AlertTriangle, Info } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import { parseCron, nextRuns, FIELDS, MACROS } from '../../utils/cron';
import './Tools.css';
import './CronExplainer.css';

const PRESETS = [
  ['* * * * *', 'Every minute'],
  ['*/5 * * * *', 'Every 5 minutes'],
  ['0 * * * *', 'Hourly'],
  ['0 0 * * *', 'Daily at midnight'],
  ['0 9 * * 1-5', 'Weekdays at 9:00'],
  ['30 2 * * 0', 'Sundays at 2:30'],
  ['0 0 1 * *', 'Monthly'],
  ['0 0 1 1 *', 'Yearly'],
  ['*/30 * * * * *', 'Every 30 s (6 fields)'],
];

const FIELD_HELP = {
  second: '0–59',
  minute: '0–59',
  hour: '0–23',
  dom: '1–31',
  month: '1–12 or JAN–DEC',
  dow: '0–6 (Sun=0) or SUN–SAT',
};

const CronExplainer = () => {
  usePageTitle('Cron Explainer');
  const [expr, setExpr] = useState('*/15 9-17 * * MON-FRI');
  const [use24h, setUse24h] = useState(true);
  const [utc, setUtc] = useState(false);
  const [runCount, setRunCount] = useState(10);

  const trimmed = expr.trim();

  const description = useMemo(() => {
    if (!trimmed) return { text: '' };
    try {
      const source = MACROS[trimmed.toLowerCase()] || trimmed;
      return { text: cronstrue.toString(source, { use24HourTimeFormat: use24h, verbose: true }) };
    } catch (err) {
      return { error: String(err).replace(/^Error:\s*/, '') };
    }
  }, [trimmed, use24h]);

  const schedule = useMemo(() => {
    if (!trimmed) return null;
    try {
      const parsed = parseCron(trimmed);
      return { parsed, runs: nextRuns(parsed, runCount, new Date(), utc) };
    } catch (err) {
      return { error: err.message };
    }
  }, [trimmed, runCount, utc]);

  const parts = (MACROS[trimmed.toLowerCase()] || trimmed).split(/\s+/);
  const fieldDefs = parts.length === 6 ? FIELDS : FIELDS.slice(1);

  const fmt = (d) => d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: schedule?.parsed?.withSeconds ? '2-digit' : undefined,
    hour12: !use24h, timeZone: utc ? 'UTC' : undefined,
  });

  return (
    <div className="tool-page">
      <ToolHeader
        title="Cron Explainer"
        description="Turn cron expressions into plain English, see each field broken down, and preview the next run times."
        icon={CalendarClock}
        color="#f43f5e"
      >
        <ShareHistory
          toolId="cron"
          state={{ expr }}
          isEmpty={(s) => !s.expr.trim()}
          onRestore={(s) => setExpr(s.expr || '')}
        />
      </ToolHeader>

      <div className="util-card mb-4">
        <div className="cron-input-row">
          <input
            className="form-input mono-input cron-input"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="*/5 * * * *"
            spellCheck="false"
            aria-label="Cron expression"
          />
          <CopyButton text={trimmed} className="btn btn-outline btn-sm" label="Copy" />
        </div>
        <div className="chip-row mt-3">
          {PRESETS.map(([value, label]) => (
            <button key={value} type="button" className={`chip ${trimmed === value ? 'active' : ''}`} onClick={() => setExpr(value)} title={value}>
              {label}
            </button>
          ))}
        </div>

        {description.text && <p className="cron-description">“{description.text}”</p>}
        {description.error && <div className="inline-error mt-3"><AlertTriangle size={15} /> {description.error}</div>}
      </div>

      <div className="util-grid">
        <div className="util-card">
          <div className="util-card-title">Fields</div>
          <div className="cron-fields">
            {fieldDefs.map((f, i) => (
              <div key={f.key} className={`cron-field ${parts[i] === undefined ? 'missing' : ''}`}>
                <code className="cron-field-value">{parts[i] ?? '—'}</code>
                <span className="cron-field-label">{f.label}</span>
                <span className="cron-field-range">{FIELD_HELP[f.key]}</span>
              </div>
            ))}
          </div>
          <table className="kv-table mt-4 cron-syntax">
            <tbody>
              <tr><th><code>*</code></th><td>any value</td></tr>
              <tr><th><code>,</code></th><td>list: <code>1,15</code></td></tr>
              <tr><th><code>-</code></th><td>range: <code>9-17</code></td></tr>
              <tr><th><code>/</code></th><td>step: <code>*/10</code>, <code>5-59/15</code></td></tr>
              <tr><th><code>@daily</code></th><td>also @hourly, @weekly, @monthly, @yearly</td></tr>
            </tbody>
          </table>
        </div>

        <div className="util-card">
          <div className="util-card-title">
            <span>Next runs</span>
            <div className="flex items-center gap-2">
              <select className="form-select" value={runCount} onChange={(e) => setRunCount(Number(e.target.value))} style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} aria-label="Number of runs">
                {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <div className="segmented" role="group" aria-label="Time zone">
                <button type="button" className={!utc ? 'active' : ''} onClick={() => setUtc(false)}>Local</button>
                <button type="button" className={utc ? 'active' : ''} onClick={() => setUtc(true)}>UTC</button>
              </div>
              <div className="segmented" role="group" aria-label="Clock">
                <button type="button" className={use24h ? 'active' : ''} onClick={() => setUse24h(true)}>24h</button>
                <button type="button" className={!use24h ? 'active' : ''} onClick={() => setUse24h(false)}>12h</button>
              </div>
            </div>
          </div>
          {schedule?.error && <div className="text-sm text-muted flex gap-2"><Info size={15} className="flex-shrink-0" style={{ marginTop: 3 }} /> {schedule.error}</div>}
          {schedule?.runs && (
            schedule.runs.length === 0
              ? <div className="empty-hint">No run in the next five years.</div>
              : (
                <ol className="cron-runs">
                  {schedule.runs.map((d) => (
                    <li key={d.getTime()}>
                      <span>{fmt(d)}</span>
                      <span className="text-muted text-xs">{relativeFromNow(d)}</span>
                    </li>
                  ))}
                </ol>
              )
          )}
        </div>
      </div>
    </div>
  );
};

function relativeFromNow(d) {
  const mins = Math.round((d - Date.now()) / 60000);
  if (mins < 1) return 'in < 1 min';
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} days`;
}

export default CronExplainer;
