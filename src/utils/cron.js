// Minimal cron parser for previewing upcoming run times.
// Supports 5 fields (minute hour day-of-month month day-of-week) or 6 with leading seconds,
// with *, ?, lists, ranges, steps, month/day names and the common @macros.

export const MACROS = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const FIELDS = [
  { key: 'second', label: 'Second', min: 0, max: 59 },
  { key: 'minute', label: 'Minute', min: 0, max: 59 },
  { key: 'hour', label: 'Hour', min: 0, max: 23 },
  { key: 'dom', label: 'Day of month', min: 1, max: 31 },
  { key: 'month', label: 'Month', min: 1, max: 12, names: MONTHS, offset: 1 },
  { key: 'dow', label: 'Day of week', min: 0, max: 7, names: DAYS, offset: 0 },
];

function parseValue(token, field) {
  if (field.names) {
    const idx = field.names.indexOf(token.toUpperCase());
    if (idx !== -1) return idx + field.offset;
  }
  if (!/^\d+$/.test(token)) throw new Error(`“${token}” is not valid in the ${field.label.toLowerCase()} field`);
  const n = Number(token);
  if (n < field.min || n > field.max) throw new Error(`${field.label} must be between ${field.min} and ${field.max} (got ${n})`);
  return n;
}

function parseField(expr, field) {
  const values = new Set();
  for (const part of expr.split(',')) {
    if (!part) throw new Error(`Empty list item in the ${field.label.toLowerCase()} field`);
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step “${stepPart}” in the ${field.label.toLowerCase()} field`);
    let start;
    let end;
    if (rangePart === '*' || rangePart === '?') {
      start = field.min;
      end = field.max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      start = parseValue(a, field);
      end = parseValue(b, field);
      if (end < start) throw new Error(`Range ${rangePart} runs backwards`);
    } else {
      start = parseValue(rangePart, field);
      end = stepPart === undefined ? start : field.max;
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  if (field.key === 'dow' && values.has(7)) { values.delete(7); values.add(0); }
  return values;
}

/** Parses an expression into per-field value sets. Throws with a readable message. */
export function parseCron(expression) {
  let expr = expression.trim();
  if (MACROS[expr.toLowerCase()]) expr = MACROS[expr.toLowerCase()];
  if (/^@reboot$/i.test(expr)) throw new Error('@reboot runs once at startup and has no schedule');
  if (/[LW#]/i.test(expr.replace(/[A-Z]{3}/gi, (m) => (MONTHS.includes(m.toUpperCase()) || DAYS.includes(m.toUpperCase()) ? 'x' : m)))) {
    throw new Error('L, W and # (Quartz extensions) are explained above but not previewed');
  }
  const parts = expr.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) throw new Error(`Expected 5 fields (or 6 with seconds), got ${parts.length}`);
  const withSeconds = parts.length === 6;
  const fields = withSeconds ? FIELDS : FIELDS.slice(1);
  const parsed = { withSeconds, raw: {} };
  fields.forEach((f, i) => {
    parsed[f.key] = parseField(parts[i], f);
    parsed.raw[f.key] = parts[i];
  });
  if (!withSeconds) parsed.second = new Set([0]);
  // Standard cron: when both day fields are restricted, a day matches if EITHER matches
  parsed.domStar = /^[*?]$/.test(parsed.raw.dom);
  parsed.dowStar = /^[*?]$/.test(parsed.raw.dow);
  return parsed;
}

const sorted = (set) => [...set].sort((a, b) => a - b);

/** Next `count` run times after `from`, in local time or UTC. */
export function nextRuns(parsed, count = 10, from = new Date(), utc = false) {
  const get = (d, part) => (utc ? d[`getUTC${part}`]() : d[`get${part}`]());
  const make = (y, mo, day, h, mi, s) => (utc ? new Date(Date.UTC(y, mo, day, h, mi, s)) : new Date(y, mo, day, h, mi, s));
  const hours = sorted(parsed.hour);
  const minutes = sorted(parsed.minute);
  const seconds = sorted(parsed.second);

  const dayMatches = (d) => {
    const domOk = parsed.dom.has(get(d, 'Date'));
    const dowOk = parsed.dow.has(get(d, 'Day'));
    if (parsed.domStar && parsed.dowStar) return true;
    if (parsed.domStar) return dowOk;
    if (parsed.dowStar) return domOk;
    return domOk || dowOk;
  };

  const runs = [];
  let day = make(get(from, 'FullYear'), get(from, 'Month'), get(from, 'Date'), 0, 0, 0);
  // Five years covers every valid schedule (e.g. Feb 29 on a given weekday)
  for (let i = 0; i < 366 * 5 && runs.length < count; i++, day = make(get(day, 'FullYear'), get(day, 'Month'), get(day, 'Date') + 1, 0, 0, 0)) {
    if (!parsed.month.has(get(day, 'Month') + 1) || !dayMatches(day)) continue;
    for (const h of hours) {
      for (const m of minutes) {
        for (const s of seconds) {
          const t = make(get(day, 'FullYear'), get(day, 'Month'), get(day, 'Date'), h, m, s);
          // Skip times that DST moved to another hour
          if (get(t, 'Hours') !== h || t <= from) continue;
          runs.push(t);
          if (runs.length >= count) return runs;
        }
      }
    }
  }
  return runs;
}
