// Parsing and serialising JSON, YAML, XML and CSV through a plain JavaScript value.
import JSON5 from 'json5';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import Papa from 'papaparse';

export const DATA_FORMATS = [
  { value: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
  { value: 'yaml', label: 'YAML', ext: 'yaml', mime: 'text/yaml' },
  { value: 'xml', label: 'XML', ext: 'xml', mime: 'application/xml' },
  { value: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
];

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  allowBooleanAttributes: true,
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Guesses the format of pasted text. */
export function detectFormat(text) {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith('<')) return 'xml';
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  const firstLine = t.split('\n', 1)[0];
  if (/^---|^[\w"'-][^:,]*:\s|^-\s/.test(firstLine)) return 'yaml';
  if ((firstLine.match(/[,;\t]/g) || []).length >= 1) return 'csv';
  return 'yaml';
}

// ---- CSV helpers ----

/** Flattens nested objects into dotted keys so they fit in CSV columns. */
function flatten(value, prefix = '', out = {}) {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0 && prefix) out[prefix] = '';
    keys.forEach((k) => flatten(value[k], prefix ? `${prefix}.${k}` : k, out));
  } else if (Array.isArray(value)) {
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) {
      out[prefix] = value.join('; ');
    } else {
      value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    }
  } else {
    out[prefix || 'value'] = value;
  }
  return out;
}

/** Rebuilds nested objects from dotted CSV headers (inverse of flatten for objects). */
function unflatten(row) {
  const out = {};
  for (const [key, val] of Object.entries(row)) {
    const parts = key.split('.');
    let node = out;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) node[part] = val;
      else node = node[part] = isPlainObject(node[part]) ? node[part] : {};
    });
  }
  return out;
}

/** Picks the list of records to write as CSV rows. */
function toRecords(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) {
    // { "users": [...] } or <root><item/>…</root> → the inner list
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const inner = value[keys[0]];
      if (Array.isArray(inner)) return inner;
      if (isPlainObject(inner)) {
        const innerKeys = Object.keys(inner);
        if (innerKeys.length === 1 && Array.isArray(inner[innerKeys[0]])) return inner[innerKeys[0]];
      }
    }
    // { "team": "x", "members": [{…}, {…}] } → the one list of records is the table
    const recordLists = keys.filter((k) => Array.isArray(value[k]) && value[k].length && value[k].every(isPlainObject));
    if (recordLists.length === 1) return value[recordLists[0]];
    return [value];
  }
  return [{ value }];
}

// ---- Public API ----

export function parseData(text, format, options = {}) {
  switch (format) {
    case 'json':
      try {
        return JSON.parse(text);
      } catch (err) {
        // Accept comments, trailing commas and unquoted keys as a fallback
        try { return JSON5.parse(text); } catch { throw err; }
      }
    case 'yaml':
      return loadYaml(text);
    case 'xml': {
      const valid = XMLValidator.validate(text);
      if (valid !== true) throw new Error(`${valid.err.msg} (line ${valid.err.line}, column ${valid.err.col})`);
      return new XMLParser(XML_OPTIONS).parse(text);
    }
    case 'csv': {
      const res = Papa.parse(text.trim(), {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: options.delimiter === 'auto' ? '' : options.delimiter,
      });
      const fatal = res.errors.find((e) => e.type !== 'Delimiter');
      if (fatal) throw new Error(`${fatal.message} (row ${fatal.row + 2})`);
      return options.nest ? res.data.map(unflatten) : res.data;
    }
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export function serializeData(value, format, options = {}) {
  const indent = options.indent || 2;
  switch (format) {
    case 'json':
      return JSON.stringify(value, null, indent);
    case 'yaml':
      return dumpYaml(value, { indent, lineWidth: -1, noRefs: true });
    case 'xml': {
      // XML needs exactly one root element
      let doc = value;
      const keys = isPlainObject(value) ? Object.keys(value).filter((k) => !k.startsWith('?')) : [];
      if (!(isPlainObject(value) && keys.length === 1 && !Array.isArray(value[keys[0]]))) {
        const root = options.rootName || 'root';
        doc = Array.isArray(value) ? { [root]: { item: value } } : { [root]: value };
      }
      const xml = new XMLBuilder({ ...XML_OPTIONS, format: true, indentBy: ' '.repeat(indent), suppressEmptyNode: true }).build(doc);
      return `<?xml version="1.0" encoding="UTF-8"?>\n${xml.trim()}`;
    }
    case 'csv': {
      const rows = toRecords(value).map((r) => flatten(r));
      // Union of all columns, in first-seen order
      const fields = [];
      const seen = new Set();
      rows.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.has(k)) { seen.add(k); fields.push(k); } }));
      const delimiter = !options.delimiter || options.delimiter === 'auto' ? ',' : options.delimiter;
      return Papa.unparse({ fields, data: rows.map((r) => fields.map((f) => r[f] ?? '')) }, { delimiter });
    }
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
