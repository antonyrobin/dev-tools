// "Fix syntax": repairs common mistakes so the input can be parsed and formatted.
// Each fixer returns { text, fixes } where fixes is a list of human-readable notes,
// or throws when the input is too broken to repair.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ===== JSON =====

const STRUCTURAL = new Set(['{', '}', '[', ']', ':', ',']);
const LITERALS = {
  true: true, false: false, null: null,
  True: true, False: false, None: null, TRUE: true, FALSE: false, NULL: null, Null: null,
  undefined: null, NaN: null, Infinity: null, '-Infinity': null,
};

/** Splits relaxed JSON into tokens, recording what had to be normalised. */
function tokenize(src, stats) {
  const tokens = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿' || c === ' ') { i++; continue; }

    // Comments: // line, /* block */, # line
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      stats.comments++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      stats.comments++;
      continue;
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      stats.comments++;
      continue;
    }

    if (STRUCTURAL.has(c)) { tokens.push({ t: c }); i++; continue; }
    if (c === ';') { tokens.push({ t: ',' }); stats.semicolons++; i++; continue; }
    if (c === '=' && src[i + 1] !== '=') { tokens.push({ t: ':' }); stats.equals++; i++; continue; }

    // Strings in any quote style
    if (c === '"' || c === "'" || c === '`' || c === '“' || c === '‘') {
      const close = c === '“' ? '”' : c === '‘' ? '’' : c;
      let j = i + 1;
      let raw = '';
      let terminated = false;
      while (j < n) {
        const ch = src[j];
        if (ch === '\\' && j + 1 < n) { raw += ch + src[j + 1]; j += 2; continue; }
        if (ch === close) { terminated = true; j++; break; }
        if (ch === '\n' && c !== '`') break;
        raw += ch;
        j++;
      }
      if (!terminated) stats.unterminated++;
      if (c !== '"') stats.quotes++;
      tokens.push({ t: 'str', v: decodeString(raw, c) });
      i = j;
      continue;
    }

    // Numbers (also +1, .5, 5., hex)
    const num = /^[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?![\w$])/.exec(src.slice(i, i + 64));
    if (num) {
      const value = Number(num[0]);
      if (Number.isFinite(value)) {
        if (String(value) !== num[0] && !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(num[0])) stats.numbers++;
        tokens.push({ t: 'num', v: value, raw: num[0] });
        i += num[0].length;
        continue;
      }
    }

    // Bare words: run until structure, a quote or the end of the line.
    // A colon followed by "//" stays inside (URLs as unquoted values).
    let j = i;
    while (j < n) {
      const ch = src[j];
      if (ch === '\n' || ch === '"' || ch === "'" || ch === '`' || ch === ';') break;
      if (ch === ':' && src.startsWith('//', j + 1)) { j += 3; continue; }
      if (STRUCTURAL.has(ch) || (ch === '=' && src[j + 1] !== '=')) break;
      j++;
    }
    tokens.push({ t: 'word', v: src.slice(i, j).trim() });
    i = j;
  }
  return tokens;
}

function decodeString(raw, quote) {
  // Re-escape for JSON: keep valid escapes, unescape \' and \` (not JSON), escape raw " and control chars
  let body = '';
  for (let k = 0; k < raw.length; k++) {
    const ch = raw[k];
    if (ch === '\\' && k + 1 < raw.length) {
      const nx = raw[++k];
      body += quote !== '"' && (nx === "'" || nx === '`') ? nx : ch + nx;
    } else if (ch === '"') body += '\\"';
    else if (ch === '\n') body += '\\n';
    else if (ch === '\r') body += '\\r';
    else if (ch === '\t') body += '\\t';
    else body += ch;
  }
  try {
    return JSON.parse(`"${body}"`);
  } catch {
    return raw;
  }
}

class JsonRepairer {
  constructor(tokens, stats) {
    this.tokens = tokens;
    this.pos = 0;
    this.stats = stats;
  }

  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  startsValue(tok) {
    return tok && (tok.t === '{' || tok.t === '[' || tok.t === 'str' || tok.t === 'num' || tok.t === 'word');
  }

  value() {
    const tok = this.next();
    if (!tok) throw new Error('Unexpected end of input');
    switch (tok.t) {
      case '{': return this.object();
      case '[': return this.array();
      case 'str': return tok.v;
      case 'num': return tok.v;
      case 'word':
        if (Object.prototype.hasOwnProperty.call(LITERALS, tok.v)) {
          if (!['true', 'false', 'null'].includes(tok.v)) this.stats.literals++;
          return LITERALS[tok.v];
        }
        this.stats.values++;
        return tok.v;
      default:
        throw new Error(`Unexpected "${tok.t}"`);
    }
  }

  object() {
    const out = {};
    for (;;) {
      let tok = this.peek();
      while (tok && tok.t === ',') { this.pos++; tok = this.peek(); this.stats.extraCommas++; }
      if (!tok) { this.stats.unclosed++; return out; }
      if (tok.t === '}') { this.pos++; return out; }
      if (tok.t === ']') { this.pos++; this.stats.mismatched++; return out; }

      // Key
      this.pos++;
      let key;
      if (tok.t === 'str') key = tok.v;
      else if (tok.t === 'num') { key = tok.raw; this.stats.keys++; }
      else if (tok.t === 'word') { key = tok.v; this.stats.keys++; }
      else throw new Error(`Expected a property name, found "${tok.t}"`);

      // Colon (may be missing)
      tok = this.peek();
      if (tok && tok.t === ':') this.pos++;
      else if (this.startsValue(tok)) this.stats.colons++;
      else { out[key] = null; this.stats.missingValues++; }

      if (this.startsValue(this.peek())) out[key] = this.value();
      else if (!(key in out)) { out[key] = null; this.stats.missingValues++; }

      tok = this.peek();
      if (!tok) { this.stats.unclosed++; return out; }
      if (tok.t === ',') {
        this.pos++;
        const after = this.peek();
        if (after && (after.t === '}' || after.t === ']')) this.stats.trailingCommas++;
      } else if (tok.t !== '}' && tok.t !== ']') {
        this.stats.commas++;
      }
    }
  }

  array() {
    const out = [];
    for (;;) {
      let tok = this.peek();
      while (tok && tok.t === ',') { this.pos++; tok = this.peek(); this.stats.extraCommas++; }
      if (!tok) { this.stats.unclosed++; return out; }
      if (tok.t === ']') { this.pos++; return out; }
      if (tok.t === '}') { this.pos++; this.stats.mismatched++; return out; }
      if (tok.t === ':') throw new Error('Unexpected ":" inside an array');

      out.push(this.value());

      tok = this.peek();
      if (!tok) { this.stats.unclosed++; return out; }
      if (tok.t === ',') {
        this.pos++;
        const after = this.peek();
        if (after && (after.t === ']' || after.t === '}')) this.stats.trailingCommas++;
      } else if (tok.t !== ']' && tok.t !== '}') {
        this.stats.commas++;
      }
    }
  }
}

const JSON_FIX_NOTES = [
  ['keys', (n) => `quoted ${plural(n, 'property name')}`],
  ['quotes', (n) => `converted ${plural(n, 'string')} to double quotes`],
  ['values', (n) => `quoted ${plural(n, 'bare value')}`],
  ['literals', (n) => `normalised ${plural(n, 'literal')} (True/None/undefined…)`],
  ['commas', (n) => `added ${plural(n, 'missing comma')}`],
  ['trailingCommas', (n) => `removed ${plural(n, 'trailing comma')}`],
  ['extraCommas', (n) => `removed ${plural(n, 'extra comma')}`],
  ['colons', (n) => `added ${plural(n, 'missing colon')}`],
  ['equals', (n) => `replaced ${plural(n, '"="')} with ":"`],
  ['semicolons', (n) => `replaced ${plural(n, 'semicolon')} with commas`],
  ['comments', (n) => `removed ${plural(n, 'comment')}`],
  ['numbers', (n) => `normalised ${plural(n, 'number')}`],
  ['unterminated', (n) => `closed ${plural(n, 'unterminated string')}`],
  ['unclosed', (n) => `closed ${plural(n, 'unclosed bracket')}`],
  ['mismatched', (n) => `fixed ${plural(n, 'mismatched bracket')}`],
  ['missingValues', (n) => `set ${plural(n, 'missing value')} to null`],
  ['wrapped', () => 'wrapped multiple top-level values in an array'],
];

export function fixJson(input, indent = 2) {
  const src = input.trim();
  if (!src) return { text: input, fixes: [] };
  try {
    return { text: JSON.stringify(JSON.parse(src), null, indent), fixes: [] };
  } catch { /* needs repair */ }

  const stats = Object.fromEntries(JSON_FIX_NOTES.map(([k]) => [k, 0]));
  // Strip JSONP / assignment wrappers like `callback({...})` or `const data = {...};`
  let body = src.replace(/^(?:(?:const|let|var)\s+[\w$]+\s*=\s*|module\.exports\s*=\s*|export\s+default\s+)/, '');
  const jsonp = /^[\w$.]+\s*\(([\s\S]*)\)\s*;?$/.exec(body);
  if (jsonp) body = jsonp[1];
  if (body !== src) stats.wrapperRemoved = 1;

  const tokens = tokenize(body, stats);
  // A trailing ';' after the root value is not a missing comma
  while (tokens.length && tokens[tokens.length - 1].t === ',') tokens.pop();
  const repairer = new JsonRepairer(tokens, stats);
  const values = [];
  while (repairer.pos < tokens.length) {
    const tok = repairer.peek();
    if (tok.t === '}' || tok.t === ']' || tok.t === ',') { repairer.pos++; stats.mismatched++; continue; }
    values.push(repairer.value());
  }
  if (!values.length) throw new Error('No JSON value found');
  if (values.length > 1) stats.wrapped = 1;
  const result = values.length > 1 ? values : values[0];

  const fixes = JSON_FIX_NOTES.filter(([k]) => stats[k]).map(([k, note]) => note(stats[k]));
  if (stats.wrapperRemoved) fixes.unshift('removed the JavaScript wrapper around the data');
  return { text: JSON.stringify(result, null, indent), fixes };
}

// ===== HTML =====

/** Lets the browser's HTML parser close unclosed tags, quote attributes and fix nesting. */
export function fixHtml(input) {
  if (typeof document === 'undefined') throw new Error('HTML repair needs a browser');
  const isDocument = /<!doctype|<html[\s>]/i.test(input);
  let text;
  if (isDocument) {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const doctype = /<!doctype[^>]*>/i.exec(input)?.[0] || '<!DOCTYPE html>';
    text = `${doctype}\n${doc.documentElement.outerHTML}`;
  } else {
    // <template> parses fragments (even lone <td>/<li>) without discarding them
    const tpl = document.createElement('template');
    tpl.innerHTML = input;
    text = tpl.innerHTML;
  }
  const fixes = [];
  if (text.replace(/\s+/g, '') !== input.replace(/\s+/g, '')) fixes.push('closed unclosed tags and normalised markup');
  return { text, fixes };
}

// ===== YAML =====

export function fixYaml(input, indent = 2) {
  let tabs = 0;
  let colons = 0;
  let trailing = 0;
  const unit = typeof indent === 'number' ? ' '.repeat(indent) : '  ';
  const lines = input.split('\n').map((line) => {
    let out = line.replace(/^(\s*)/, (lead) => {
      if (!lead.includes('\t')) return lead;
      tabs++;
      return lead.replace(/\t/g, unit);
    });
    // "key:value" → "key: value" (but leave URLs, times and quoted text alone)
    out = out.replace(/^(\s*(?:- )?[A-Za-z_][\w.-]*):(?=[^\s/:])/, (m, key) => { colons++; return `${key}: `; });
    const trimmed = out.replace(/[ \t]+$/, '');
    if (trimmed !== out) trailing++;
    return trimmed;
  });
  const fixes = [];
  if (tabs) fixes.push(`replaced tab indentation on ${plural(tabs, 'line')}`);
  if (colons) fixes.push(`added a space after ${plural(colons, 'colon')}`);
  if (trailing) fixes.push(`removed trailing spaces on ${plural(trailing, 'line')}`);
  return { text: lines.join('\n'), fixes };
}

export const SYNTAX_FIXERS = { json: fixJson, html: fixHtml, yaml: fixYaml };
