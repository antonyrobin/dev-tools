// Must run before Prism loads: stops Prism from installing its own worker message handler
import './prismWorkerSetup';
import { highlightToLines } from './highlight';

// Highlights large files off the main thread so formatting them never freezes the UI
self.onmessage = (e) => {
  const { id, code, language } = e.data;
  try {
    self.postMessage({ id, lines: highlightToLines(code, language) });
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Highlighting failed' });
  }
};
