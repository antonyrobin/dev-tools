// Client for the free Wandbox compiler service (https://github.com/melpon/wandbox),
// used by the Code Compiler for every language that can't run in the browser.

const API = 'https://wandbox.org/api';

let listPromise = null;

/** All compilers Wandbox offers, fetched once per page load. */
export const fetchCompilers = () => {
  if (!listPromise) {
    listPromise = fetch(`${API}/list.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        listPromise = null;
        throw err;
      });
  }
  return listPromise;
};

/** Compilers for one language, best default first (stable releases before "head" builds). */
export const compilersFor = (all, language, prefer) => {
  const list = all.filter((c) => c.language === language);
  const rank = (c) => (/head/.test(c.name) ? 2 : 0) + (prefer && !prefer.test(c.name) ? 1 : 0);
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
};

// The switches the Wandbox UI enables by default (warnings, language standard, ...)
const defaultOptions = (compiler) =>
  (compiler.switches || [])
    .flatMap((s) => {
      if (s.type === 'single') return s.default ? [s.name] : [];
      if (s.type === 'select') return s.default ? [s.default] : [];
      return [];
    })
    .join(',');

/**
 * Compiles and runs `code`. Resolves with Wandbox's result:
 * { status, signal, compiler_message, program_output, program_error, ... }
 */
export async function runRemote({ compiler, code, stdin, compilerFlags, signal }) {
  const res = await fetch(`${API}/compile.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      compiler: compiler.name,
      code,
      stdin: stdin || '',
      options: defaultOptions(compiler),
      'compiler-option-raw': (compilerFlags || '').trim().split(/\s+/).filter(Boolean).join('\n'),
      save: false,
    }),
  });
  if (!res.ok) throw new Error(`The compiler service returned HTTP ${res.status}`);
  return res.json();
}
