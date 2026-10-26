// Infers TypeScript declarations from a JSON sample.
// Arrays of objects are merged, so keys missing from some items become optional.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const toPascal = (str) => {
  const cleaned = String(str)
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[a-z]/, (c) => c.toUpperCase());
  if (!cleaned) return 'Item';
  return /^\d/.test(cleaned) ? `T${cleaned}` : cleaned;
};

// Simple English singular for array item names: "users" → "User", "categories" → "Category"
const singular = (name) => {
  if (/ies$/i.test(name)) return name.replace(/ies$/i, 'y');
  if (/(ss|us)$/i.test(name)) return name;
  if (/(x|ch|sh|ses)$/i.test(name)) return name.replace(/es$/i, '');
  if (/s$/i.test(name)) return name.slice(0, -1);
  return `${name}Item`;
};

export function jsonToTypeScript(value, options = {}) {
  const {
    rootName = 'Root',
    useType = false,
    optionalNull = false,
    readonly = false,
    exportDecl = true,
  } = options;

  const declarations = []; // { name, body } in creation order (children first)
  const byBody = new Map();
  const usedNames = new Set();

  const uniqueName = (base) => {
    let name = toPascal(base);
    let n = 2;
    while (usedNames.has(name)) name = `${toPascal(base)}${n++}`;
    usedNames.add(name);
    return name;
  };

  const wrapArray = (t) => (/[|&]/.test(t) ? `(${t})[]` : `${t}[]`);

  // Type for the union of all observed values of one field / array slot
  function typeOfValues(values, hint) {
    const types = [];
    const add = (t) => { if (!types.includes(t)) types.push(t); };

    const objects = values.filter(isPlainObject);
    const arrays = values.filter(Array.isArray);
    for (const v of values) {
      if (v === null) add('null');
      else if (!isPlainObject(v) && !Array.isArray(v)) add(typeof v);
    }
    if (objects.length) add(declareObject(objects, hint));
    if (arrays.length) {
      const items = arrays.flat();
      add(items.length ? wrapArray(typeOfValues(items, singular(hint))) : 'unknown[]');
    }
    return types.join(' | ') || 'unknown';
  }

  function declareObject(objects, hint) {
    const keys = [];
    const seen = new Set();
    objects.forEach((o) => Object.keys(o).forEach((k) => { if (!seen.has(k)) { seen.add(k); keys.push(k); } }));

    const lines = keys.map((key) => {
      const present = objects.filter((o) => key in o).map((o) => o[key]);
      let type = typeOfValues(present, key);
      let optional = present.length < objects.length;
      if (optionalNull && type.includes('null')) {
        optional = true;
        type = type.split(' | ').filter((t) => t !== 'null').join(' | ') || 'null';
      }
      const prop = IDENTIFIER.test(key) ? key : JSON.stringify(key);
      return `  ${readonly ? 'readonly ' : ''}${prop}${optional ? '?' : ''}: ${type};`;
    });

    const body = lines.join('\n');
    // Structurally identical objects share one declaration
    if (byBody.has(body)) return byBody.get(body);
    const name = uniqueName(hint);
    byBody.set(body, name);
    declarations.push({ name, body });
    return name;
  }

  const prefix = exportDecl ? 'export ' : '';
  const rootType = typeOfValues([value], rootName);
  const rootPascal = toPascal(rootName);

  const out = declarations
    .slice()
    .reverse()
    .map(({ name, body }) => (useType
      ? `${prefix}type ${name} = {\n${body}\n};`
      : `${prefix}interface ${name} {\n${body}\n}`));

  // Root is an array or primitive: give it a named alias as well
  if (rootType !== rootPascal) out.unshift(`${prefix}type ${rootPascal}${usedNames.has(rootPascal) ? 'Type' : ''} = ${rootType};`);

  return out.join('\n\n');
}
