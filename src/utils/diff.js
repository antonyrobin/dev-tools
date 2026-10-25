// Line + inline-word diff based on Myers' O(ND) algorithm (linear-space variant).
// Replaces the previous O(N*M) LCS table, which allocated N*M cells and froze the page
// for files with a few thousand lines.

/**
 * Finds the middle snake of a[aLo..aHi) vs b[bLo..bHi).
 * Returns [x, y, u, v]: the snake runs from (x, y) to (u, v) in absolute indices.
 */
function middleSnake(a, aLo, aHi, b, bLo, bHi, vf, vb) {
  const N = aHi - aLo;
  const M = bHi - bLo;
  const delta = N - M;
  const odd = (delta & 1) !== 0;
  const max = Math.ceil((N + M) / 2);
  const o = max + 1;

  vf[o + 1] = 0;
  vb[o + 1] = 0;

  for (let d = 0; d <= max; d++) {
    // Forward pass
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && vf[o + k - 1] < vf[o + k + 1])) ? vf[o + k + 1] : vf[o + k - 1] + 1;
      let y = x - k;
      const x0 = x;
      const y0 = y;
      while (x < N && y < M && a[aLo + x] === b[bLo + y]) { x++; y++; }
      vf[o + k] = x;
      if (odd && k >= delta - (d - 1) && k <= delta + (d - 1)) {
        if (vf[o + k] + vb[o + delta - k] >= N) {
          return [aLo + x0, bLo + y0, aLo + x, bLo + y];
        }
      }
    }
    // Backward pass (coordinates measured from the end)
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && vb[o + k - 1] < vb[o + k + 1])) ? vb[o + k + 1] : vb[o + k - 1] + 1;
      let y = x - k;
      const x0 = x;
      const y0 = y;
      while (x < N && y < M && a[aHi - 1 - x] === b[bHi - 1 - y]) { x++; y++; }
      vb[o + k] = x;
      if (!odd && k >= delta - d && k <= delta + d) {
        if (vb[o + k] + vf[o + delta - k] >= N) {
          return [aLo + N - x, bLo + M - y, aLo + N - x0, bLo + M - y0];
        }
      }
    }
  }
  return [aLo, bLo, aLo, bLo];
}

/**
 * Myers diff on two integer/string arrays.
 * Returns ops in order: { t: '=', i, j } | { t: '-', i } | { t: '+', j }
 */
export function myersDiff(a, b) {
  const ops = [];
  const size = 2 * (a.length + b.length) + 4;
  const vf = new Int32Array(size);
  const vb = new Int32Array(size);

  const rec = (aLo, aHi, bLo, bHi) => {
    // Common prefix
    while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
      ops.push({ t: '=', i: aLo, j: bLo });
      aLo++; bLo++;
    }
    // Common suffix (emitted after the middle part)
    let suffix = 0;
    while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
      aHi--; bHi--; suffix++;
    }

    if (aLo === aHi) {
      for (let j = bLo; j < bHi; j++) ops.push({ t: '+', j });
    } else if (bLo === bHi) {
      for (let i = aLo; i < aHi; i++) ops.push({ t: '-', i });
    } else {
      const [x, y, u, v] = middleSnake(a, aLo, aHi, b, bLo, bHi, vf, vb);
      if ((x === aLo && y === bLo && u === aHi && v === bHi) || (x === u && y === v && x === aLo && y === bLo)) {
        // Safety net: no progress possible, treat as full replacement
        for (let i = aLo; i < aHi; i++) ops.push({ t: '-', i });
        for (let j = bLo; j < bHi; j++) ops.push({ t: '+', j });
      } else {
        rec(aLo, x, bLo, y);
        for (let i = x, j = y; i < u; i++, j++) ops.push({ t: '=', i, j });
        rec(u, aHi, v, bHi);
      }
    }

    for (let s = 0; s < suffix; s++) ops.push({ t: '=', i: aHi + s, j: bHi + s });
  };

  rec(0, a.length, 0, b.length);
  return ops;
}

const MAX_INLINE_TOKENS = 1500;

/** Inline word diff for a modified line pair. */
export function computeInlineWordDiff(origStr, modStr) {
  const origTokens = origStr.split(/(\s+|[^\w\s])/).filter(Boolean);
  const modTokens = modStr.split(/(\s+|[^\w\s])/).filter(Boolean);

  if (origTokens.length > MAX_INLINE_TOKENS || modTokens.length > MAX_INLINE_TOKENS) {
    return {
      leftTokens: [{ text: origStr, type: 'remove' }],
      rightTokens: [{ text: modStr, type: 'add' }],
    };
  }

  const leftTokens = [];
  const rightTokens = [];
  const push = (arr, text, type) => {
    const last = arr[arr.length - 1];
    if (last && last.type === type) last.text += text;
    else arr.push({ text, type });
  };

  for (const op of myersDiff(origTokens, modTokens)) {
    if (op.t === '=') {
      push(leftTokens, origTokens[op.i], 'same');
      push(rightTokens, modTokens[op.j], 'same');
    } else if (op.t === '-') {
      push(leftTokens, origTokens[op.i], 'remove');
    } else {
      push(rightTokens, modTokens[op.j], 'add');
    }
  }
  return { leftTokens, rightTokens };
}

/**
 * Full side-by-side diff model.
 * options.ignoreWhitespace / options.ignoreCase change how lines are compared (not displayed).
 */
export function computeDiff(origText, modText, options = {}) {
  const { ignoreWhitespace = false, ignoreCase = false } = options;
  const origLines = origText.split(/\r?\n/);
  const modLines = modText.split(/\r?\n/);

  // Intern normalised lines to integers for fast equality checks
  const ids = new Map();
  const normalise = (line) => {
    let key = line;
    if (ignoreWhitespace) key = key.replace(/\s+/g, ' ').trim();
    if (ignoreCase) key = key.toLowerCase();
    let id = ids.get(key);
    if (id === undefined) { id = ids.size; ids.set(key, id); }
    return id;
  };
  const a = Int32Array.from(origLines, normalise);
  const b = Int32Array.from(modLines, normalise);

  const ops = myersDiff(a, b);

  const rows = [];
  let additionsCount = 0;
  let deletionsCount = 0;
  let modificationsCount = 0;

  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.t === '=') {
      const left = origLines[op.i];
      const right = modLines[op.j];
      rows.push({
        type: 'equal',
        left: { lineNum: op.i + 1, content: left },
        right: { lineNum: op.j + 1, content: right },
      });
      k++;
      continue;
    }

    // Gather the whole change hunk between two equal lines
    const removes = [];
    const adds = [];
    while (k < ops.length && ops[k].t !== '=') {
      if (ops[k].t === '-') removes.push(ops[k].i);
      else adds.push(ops[k].j);
      k++;
    }

    const maxLen = Math.max(removes.length, adds.length);
    for (let m = 0; m < maxLen; m++) {
      const ri = removes[m];
      const ai = adds[m];
      if (ri !== undefined && ai !== undefined) {
        const inline = computeInlineWordDiff(origLines[ri], modLines[ai]);
        rows.push({
          type: 'modify',
          left: { lineNum: ri + 1, content: origLines[ri] },
          right: { lineNum: ai + 1, content: modLines[ai] },
          leftTokens: inline.leftTokens,
          rightTokens: inline.rightTokens,
        });
        modificationsCount++;
      } else if (ri !== undefined) {
        rows.push({ type: 'remove', left: { lineNum: ri + 1, content: origLines[ri] }, right: null });
        deletionsCount++;
      } else {
        rows.push({ type: 'add', left: null, right: { lineNum: ai + 1, content: modLines[ai] } });
        additionsCount++;
      }
    }
  }

  return { rows, additionsCount, deletionsCount, modificationsCount };
}
