// Prism highlighting shared by the Code Formatter and its highlight worker
import Prism from 'prismjs';

// Language components are imported statically for Cloudflare production bundle safety
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';

export const languagePrismMap = {
  json: 'json',
  javascript: 'javascript',
  html: 'markup',
  css: 'css',
  java: 'java',
  csharp: 'csharp',
  python: 'python',
  sql: 'sql',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  yaml: 'yaml',
  markdown: 'markdown',
};

/**
 * Splits Prism syntax-highlighted HTML string into individual line HTML strings,
 * properly closing and re-opening open HTML span tags across newline boundaries.
 */
export function splitPrismHtmlIntoLines(html) {
  if (!html) return [];
  const lines = [];
  const openTags = [];
  let currentLine = '';
  let last = 0;
  // Jump between tags and newlines instead of walking characters: much faster on MB-sized output
  const tokenRe = /<[^>]*>|\n/g;
  let m;
  while ((m = tokenRe.exec(html))) {
    currentLine += html.slice(last, m.index);
    last = tokenRe.lastIndex;
    const token = m[0];
    if (token === '\n') {
      lines.push(currentLine + '</span>'.repeat(openTags.length));
      currentLine = openTags.join('');
    } else {
      if (token.startsWith('</')) openTags.pop();
      else if (!token.endsWith('/>') && !token.startsWith('<?')) openTags.push(token);
      currentLine += token;
    }
  }
  lines.push(currentLine + html.slice(last));
  return lines;
}

/** Highlights code and returns one HTML string per line. */
export function highlightToLines(code, language) {
  const prismLang = languagePrismMap[language] || 'javascript';
  const grammar = Prism.languages[prismLang] || Prism.languages.javascript;
  return splitPrismHtmlIntoLines(Prism.highlight(code, grammar, prismLang));
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** Escaped, unhighlighted lines: shown instantly while a large file is highlighted off-thread. */
export function plainLines(code) {
  return code.replace(/[&<>]/g, (c) => ESCAPES[c]).split('\n');
}
