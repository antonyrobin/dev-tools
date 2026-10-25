import { computeDiff } from './diff';

// Runs the diff off the main thread so large comparisons never freeze the UI
self.onmessage = (e) => {
  const { id, original, modified, options } = e.data;
  try {
    const result = computeDiff(original, modified, options);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Diff failed' });
  }
};
