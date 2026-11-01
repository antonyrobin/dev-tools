// Runs a JavaScript snippet off the main thread so infinite loops can be stopped
// (the page terminates the worker) and console output is streamed back.

const format = (a) => {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (typeof a === 'function') return a.toString();
  if (typeof a === 'undefined') return 'undefined';
  if (typeof a === 'bigint') return `${a}n`;
  try {
    return JSON.stringify(a, null, 2) ?? String(a);
  } catch {
    return String(a);
  }
};

const post = (level, args) => self.postMessage({ type: 'log', level, text: args.map(format).join(' ') });

['log', 'info', 'warn', 'error', 'debug', 'table'].forEach((m) => {
  console[m] = (...args) => post(m === 'table' || m === 'debug' ? 'log' : m, args);
});

self.addEventListener('unhandledrejection', (e) => post('error', ['Uncaught (in promise)', e.reason]));

self.onmessage = async ({ data: { code } }) => {
  const start = performance.now();
  try {
    // Async wrapper so top-level await works in snippets
    await new Function(`return (async () => {\n${code}\n})();`)();
  } catch (err) {
    post('error', [err]);
  }
  self.postMessage({ type: 'done', ms: performance.now() - start });
};
