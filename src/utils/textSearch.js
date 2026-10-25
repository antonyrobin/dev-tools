// Shared helpers for the fast "find text" feature used by the formatter and the diff viewer.

export const MAX_MATCHES = 20000;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds a global RegExp for a find query, or null when the query is empty / invalid.
 */
export function buildSearchRegex(query, { matchCase = false, useRegex = false } = {}) {
  if (!query) return null;
  try {
    return new RegExp(useRegex ? query : escapeRegExp(query), matchCase ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Finds all matches inside a single line of plain text.
 * Calls onMatch(start, end) for each one; returns false once the global cap is hit.
 */
export function scanLine(regex, text, onMatch) {
  if (!text) return true;
  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m[0].length === 0) {
      regex.lastIndex++;
      continue;
    }
    if (onMatch(m.index, m.index + m[0].length) === false) return false;
  }
  return true;
}

/**
 * Inserts <mark> elements into an already syntax-highlighted HTML line at the given
 * plain-text offsets. Works on the text content (entities count as one character), so
 * searching for characters like <, & or " works and HTML tags are never corrupted.
 *
 * ranges: sorted [{ start, end, idx }]; activeIdx marks the current match.
 */
export function highlightHtmlRanges(html, ranges, activeIdx) {
  if (!ranges || ranges.length === 0) return html;

  const openMark = (rg) =>
    `<mark class="search-match${rg.idx === activeIdx ? ' search-match-active' : ''}" data-match-idx="${rg.idx}">`;

  let out = '';
  let textPos = 0;
  let r = 0;
  let inMark = false;
  let i = 0;
  const len = html.length;

  while (i < len) {
    const ch = html[i];
    if (ch === '<') {
      const tagEnd = html.indexOf('>', i);
      const end = tagEnd === -1 ? len - 1 : tagEnd;
      const tag = html.slice(i, end + 1);
      // Keep marks properly nested by closing/re-opening them around tags
      out += inMark ? `</mark>${tag}${openMark(ranges[r])}` : tag;
      i = end + 1;
      continue;
    }

    if (inMark && textPos >= ranges[r].end) {
      out += '</mark>';
      inMark = false;
      r++;
    }
    if (!inMark && r < ranges.length && textPos === ranges[r].start) {
      out += openMark(ranges[r]);
      inMark = true;
    }

    let charLen = 1;
    if (ch === '&') {
      const semi = html.indexOf(';', i);
      if (semi !== -1 && semi - i <= 10) charLen = semi - i + 1;
    }
    out += html.substr(i, charLen);
    i += charLen;
    textPos++;
  }

  if (inMark) out += '</mark>';
  return out;
}
