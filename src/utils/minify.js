// Lightweight, string-aware minifiers. Unlike plain regex replacement they never touch
// the contents of strings, template literals or regex literals (e.g. "http://" URLs).

const WORD = /[\w$\u0080-\uffff]/;
// After these characters a "/" starts a regex literal rather than a division
const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]$/;
const REGEX_KEYWORD_PREFIX = /(?:^|[^\w$])(return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/;
// Newlines can only be dropped safely next to these (avoids automatic-semicolon breakage)
const SAFE_BEFORE_NL = '{[(,;:=+-*/%&|?<>!~^';
const SAFE_AFTER_NL = '}]),;:.?=+*/%&|<>';

export function minifyJs(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let pendingSpace = false;
  let pendingNewline = false;

  const lastChar = () => out[out.length - 1] || '';

  const flushWhitespace = (nextChar) => {
    if (!pendingSpace && !pendingNewline) return;
    const prev = lastChar();
    if (prev) {
      if (WORD.test(prev) && WORD.test(nextChar)) {
        out += pendingNewline ? '\n' : ' ';
      } else if ((prev === '+' && nextChar === '+') || (prev === '-' && nextChar === '-')) {
        out += ' ';
      } else if (pendingNewline && !SAFE_BEFORE_NL.includes(prev) && !SAFE_AFTER_NL.includes(nextChar)) {
        out += '\n';
      }
    }
    pendingSpace = false;
    pendingNewline = false;
  };

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    // Whitespace
    if (/\s/.test(ch)) {
      if (ch === '\n' || ch === '\r') pendingNewline = true;
      else pendingSpace = true;
      i++;
      continue;
    }

    // Comments
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const comment = src.slice(i, end === -1 ? n : end + 2);
      if (comment.startsWith('/*!')) { flushWhitespace('/'); out += comment; } // keep license comments
      if (comment.includes('\n')) pendingNewline = true; else pendingSpace = true;
      i = end === -1 ? n : end + 2;
      continue;
    }

    // Strings and template literals
    if (ch === '"' || ch === "'" || ch === '`') {
      flushWhitespace(ch);
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === '\\') j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // Regex literals
    if (ch === '/') {
      const trimmed = out.replace(/\s+$/, '');
      if (!trimmed || REGEX_PREFIX.test(trimmed) || REGEX_KEYWORD_PREFIX.test(trimmed)) {
        flushWhitespace(ch);
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++; // flags
        out += src.slice(i, j);
        i = j;
        continue;
      }
    }

    flushWhitespace(ch);
    out += ch;
    i++;
  }
  return out.trim();
}

export function minifyCss(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let pendingSpace = false;

  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      pendingSpace = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === '\\') j++;
        j++;
      }
      if (pendingSpace && out && !'{};:,>~'.includes(out[out.length - 1])) out += ' ';
      pendingSpace = false;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = true;
      i++;
      continue;
    }
    if ('{};:,>~'.includes(ch)) {
      // No whitespace needed around these (":" kept spaced only in selectors like "a :hover" — rare)
      pendingSpace = false;
      if (ch === '}' && out.endsWith(';')) out = out.slice(0, -1);
      out += ch;
      i++;
      while (i < n && /\s/.test(src[i])) i++;
      continue;
    }
    if (pendingSpace && out && !'{};:,>~'.includes(out[out.length - 1])) out += ' ';
    pendingSpace = false;
    out += ch;
    i++;
  }
  return out.trim();
}

export function minifyHtml(src) {
  // Protect blocks whose whitespace matters
  const preserved = [];
  let html = src.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (block, tag) => {
    let content = block;
    const lower = tag.toLowerCase();
    if (lower === 'script' || lower === 'style') {
      content = block.replace(/^(<[^>]+>)([\s\S]*)(<\/[^>]+>)$/, (_, open, body, close) =>
        open + (lower === 'script' ? minifyJs(body) : minifyCss(body)) + close);
    }
    preserved.push(content);
    return `\uE000${preserved.length - 1}\uE000`;
  });

  html = html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  return html.replace(/\uE000(\d+)\uE000/g, (_, idx) => preserved[Number(idx)]);
}

export function minifyJson(src) {
  return JSON.stringify(JSON.parse(src));
}

export function minifyCode(src, language) {
  switch (language) {
    case 'css': return minifyCss(src);
    case 'html': return minifyHtml(src);
    case 'json': return minifyJson(src);
    default: return minifyJs(src);
  }
}
