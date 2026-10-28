import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ToolHeader from '../components/ToolHeader';
import FindBar from '../components/FindBar';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { FileJson, Play, Copy, Check, Maximize2, Minimize2, RotateCcw, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp, WrapText, Download, Trash2, AlertTriangle, Wand2, CheckCircle2 } from 'lucide-react';
import * as prettier from 'prettier/standalone';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import prettierPluginPostcss from 'prettier/plugins/postcss';
import prettierPluginMarkdown from 'prettier/plugins/markdown';
import prettierPluginYaml from 'prettier/plugins/yaml';
import ShareHistory from '../components/ShareHistory';
import useMaximize from '../hooks/useMaximize';
import { buildSearchRegex, scanLine, highlightHtmlRanges, MAX_MATCHES } from '../utils/textSearch';

import 'prismjs/themes/prism-tomorrow.css';
import { highlightToLines, plainLines, languagePrismMap } from '../utils/highlight';
import { SYNTAX_FIXERS } from '../utils/syntaxFix';

const defaultSampleCode = {
  json: '{\n  "name": "DevTools",\n  "version": "1.0.0",\n  "features": ["Formatter", "Compiler", "Compare"],\n  "status": true\n}',
  javascript: 'function greet(name){\nconsole.log("Hello, "+name+"!");\nreturn {success:true,timestamp:Date.now()};\n}',
  html: '<div class="container">\n  <h1>Hello World</h1>\n  <p>Welcome to DevTools</p>\n</div>',
  css: 'body {\n  background-color: #0a0a0e;\n  color: #fff;\n  margin: 0;\n}\nh1 {\n  font-size: 2rem;\n}',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello Java");\n  }\n}',
  csharp: 'namespace HelloApp {\n  class Program {\n    static void Main(string[] args) {\n      Console.WriteLine("Hello C#");\n    }\n  }\n}',
  python: 'def process_data(items):\n  result = [x * 2 for x in items if x > 0]\n  return result\n',
  sql: 'select u.id, u.name, count(o.id) as order_count from users u left join orders o on o.user_id = u.id where u.status = \'active\' and o.created_at > current_date - interval \'30 days\' group by u.id, u.name having count(o.id) > 2 order by order_count desc limit 10;',
  php: '<?php\n$user = ["name" => "John", "role" => "Admin"];\necho json_encode($user);\n?>',
  c: '#include <stdio.h>\nint main() {\n  printf("Hello, C World!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\nint main() {\n  std::cout << "Hello C++" << std::endl;\n  return 0;\n}',
  yaml: 'server:\n  port: 8080\n  environment: production\n  tags:\n    - web\n    - api',
  markdown: '# Title\n\n- Feature 1\n- Feature 2\n\n**Bold text** and *italic text*.'
};

/**
 * Universal fold detector algorithm for all languages:
 * Detects matching braces/brackets ({}, [], ()) and indentation blocks (Python, YAML, Markdown).
 */
function getFoldableRanges(code, language) {
  if (!code) return {};
  const lines = code.split('\n');
  const foldRanges = {}; // startLineIndex -> endLineIndex

  const stack = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '{' || char === '[' || char === '(') {
        stack.push({ char, line: i });
      } else if (char === '}' || char === ']' || char === ')') {
        const matching = char === '}' ? '{' : char === ']' ? '[' : '(';
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].char === matching) {
            const start = stack[s].line;
            if (i - start >= 1) {
              if (!foldRanges[start] || i > foldRanges[start]) {
                foldRanges[start] = i;
              }
            }
            stack.splice(s, 1);
            break;
          }
        }
      }
    }
  }

  // Indentation-based fold detection fallback (Python, YAML, Markdown)
  if (['python', 'yaml'].includes(language) || Object.keys(foldRanges).length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || foldRanges[i]) continue;

      const currentIndent = line.search(/\S/);
      if (currentIndent === -1) continue;

      let lastIndented = i;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (!nextLine.trim()) continue;
        const nextIndent = nextLine.search(/\S/);
        if (nextIndent > currentIndent) {
          lastIndented = j;
        } else {
          break;
        }
      }

      if (lastIndented > i) {
        foldRanges[i] = lastIndented;
      }
    }
  }

  return foldRanges;
}

/** Widest line in columns (tabs expanded), so the virtualized list can size its horizontal scroll. */
function getMaxColumns(code) {
  let max = 0;
  let col = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    if (c === 10) { if (col > max) max = col; col = 0; }
    else col += c === 9 ? 8 - (col % 8) : 1;
  }
  return Math.max(max, col);
}

/** Index of the first item in a sorted array that is >= value. */
function lowerBound(arr, value) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/**
 * One rendered line of the output viewer. Memoized and fed only line-local props.
 * The "active" match is never a prop: it is toggled directly on the <mark> element,
 * so stepping through search results costs no React rendering at all.
 */
const CodeLineRow = React.memo(({ lineHtml, lineIdx, hasFold, isCollapsed, collapsedCount, ranges, toggleFold }) => {
  const finalHtml = ranges ? highlightHtmlRanges(lineHtml, ranges, -1) : lineHtml;

  return (
    <div data-line={lineIdx} className="code-line-row">
      <div className="code-fold-gutter">
        <span className="line-num-text">{lineIdx + 1}</span>
        {hasFold ? (
          <button
            type="button"
            className="fold-btn"
            onClick={() => toggleFold(lineIdx)}
            title={isCollapsed ? 'Expand range' : 'Collapse range'}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className="fold-spacer" />
        )}
      </div>

      <div className="code-line-content">
        <span dangerouslySetInnerHTML={{ __html: finalHtml || ' ' }} />
        {hasFold && isCollapsed && (
          <span className="collapsed-preview-badge" onClick={() => toggleFold(lineIdx)} title="Expand range">
            … {collapsedCount} lines
          </span>
        )}
      </div>
    </div>
  );
});

const OVERSCAN_ROWS = 40;
const VIEW_PAD_TOP = 8; // .code-view-scroll top padding (0.5rem)

/**
 * Virtualized line list: only the rows around the viewport are in the DOM, so a 50k-line
 * file renders as fast as a 50-line one. Row heights are fixed without wrapping; with
 * wrapping, rendered rows are measured and cached so offsets stay accurate.
 * Also owns scrolling to and marking the active search match, since only it knows
 * where off-screen rows are.
 */
const VirtualCodeLines = React.memo(({
  scrollRef, visibleLines, highlightedLines, foldRanges, collapsedFolds, rangesByLine,
  toggleFold, className, wrap, maxColumns, activeMatch,
}) => {
  const [viewport, setViewport] = useState({ top: 0, height: 800, width: 0 });
  const [rowHeight, setRowHeight] = useState(20);
  const [measureVersion, setMeasureVersion] = useState(0);
  const innerRef = useRef(null);
  const scrolledMatchRef = useRef(null);
  const pendingHScrollRef = useRef(false);

  // Measured heights of wrapped rows; a fresh cache whenever wrapping could change
  const wrapWidth = wrap ? viewport.width : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heights = useMemo(() => new Map(), [highlightedLines, wrap, wrapWidth]);

  const offsets = useMemo(() => {
    const out = new Float64Array(visibleLines.length + 1);
    for (let i = 0; i < visibleLines.length; i++) {
      out[i + 1] = out[i] + (heights.get(visibleLines[i]) ?? rowHeight);
    }
    return out;
    // measureVersion: heights is mutated in place by measurement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLines, heights, rowHeight, measureVersion]);

  const readViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport((v) => (v.top === el.scrollTop && v.height === el.clientHeight && v.width === el.clientWidth
      ? v
      : { top: el.scrollTop, height: el.clientHeight, width: el.clientWidth }));
  }, [scrollRef]);

  // A passive effect on purpose: the parent's scrollRef is attached only after child layout effects run
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    readViewport();
    el.addEventListener('scroll', readViewport, { passive: true });
    const ro = new ResizeObserver(readViewport);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', readViewport);
      ro.disconnect();
    };
  }, [scrollRef, readViewport]);

  const count = visibleLines.length;
  const top = Math.max(0, viewport.top - VIEW_PAD_TOP);
  const first = Math.max(0, lowerBound(offsets, top + 0.5) - 1);
  const start = Math.max(0, first - OVERSCAN_ROWS);
  const end = Math.min(count, lowerBound(offsets, top + viewport.height) + OVERSCAN_ROWS);

  // Measure what was rendered: the base row height, plus every row while wrapping
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || !inner.children.length) return;
    if (!wrap) {
      const h = inner.children[0].offsetHeight;
      if (h && h !== rowHeight) setRowHeight(h);
      return;
    }
    let shiftAbove = 0;
    let changed = false;
    for (const row of inner.children) {
      const lineIdx = Number(row.dataset.line);
      const h = row.offsetHeight;
      const prev = heights.get(lineIdx) ?? rowHeight;
      if (h !== prev) {
        heights.set(lineIdx, h);
        changed = true;
        if (lowerBound(visibleLines, lineIdx) < first) shiftAbove += h - prev;
      }
    }
    if (changed) {
      // Keep the rows being read in place when rows above them get re-measured
      if (shiftAbove && scrollRef.current) scrollRef.current.scrollTop += shiftAbove;
      setMeasureVersion((v) => v + 1);
    }
  }, [wrap, rowHeight, heights, visibleLines, first, start, end, scrollRef, highlightedLines, collapsedFolds]);

  // Bring the active match into view (vertically) once per match
  useLayoutEffect(() => {
    if (!activeMatch) { scrolledMatchRef.current = null; return; }
    if (scrolledMatchRef.current === activeMatch) return;
    const pos = lowerBound(visibleLines, activeMatch.lineIdx);
    // Hidden inside a collapsed fold: the parent expands it and this runs again
    if (visibleLines[pos] !== activeMatch.lineIdx) return;
    const el = scrollRef.current;
    if (!el) return;
    scrolledMatchRef.current = activeMatch;
    pendingHScrollRef.current = true;
    const h = offsets[pos + 1] - offsets[pos];
    el.scrollTop = offsets[pos] + VIEW_PAD_TOP - el.clientHeight / 2 + h / 2;
    readViewport();
  }, [activeMatch, visibleLines, offsets, scrollRef, readViewport]);

  // Mark the active match directly in the DOM (rows are memoized, so this is cheap to redo)
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.querySelectorAll('.search-match-active').forEach((el) => el.classList.remove('search-match-active'));
    container.querySelectorAll('.has-active-match').forEach((el) => el.classList.remove('has-active-match'));
    if (!activeMatch) return;
    const mark = container.querySelector(`mark[data-match-idx="${activeMatch.idx}"]`);
    if (!mark) return;
    mark.classList.add('search-match-active');
    mark.closest('.code-line-row')?.classList.add('has-active-match');
    if (pendingHScrollRef.current) {
      pendingHScrollRef.current = false;
      if (!wrap) {
        const gutter = 80;
        const left = mark.offsetLeft;
        if (left < container.scrollLeft + gutter || left + mark.offsetWidth > container.scrollLeft + container.clientWidth - 24) {
          container.scrollLeft = Math.max(0, left - container.clientWidth / 2);
        }
      }
    }
  });

  const rows = [];
  for (let i = start; i < end; i++) {
    const lineIdx = visibleLines[i];
    const foldEnd = foldRanges[lineIdx];
    rows.push(
      <CodeLineRow
        key={lineIdx}
        lineHtml={highlightedLines[lineIdx]}
        lineIdx={lineIdx}
        hasFold={foldEnd !== undefined}
        isCollapsed={Boolean(collapsedFolds[lineIdx])}
        collapsedCount={foldEnd ? foldEnd - lineIdx : 0}
        ranges={rangesByLine.get(lineIdx)}
        toggleFold={toggleFold}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        height: offsets[count],
        minWidth: wrap ? undefined : `max(100%, calc(74px + 1.5rem + ${maxColumns}ch))`,
      }}
    >
      <div ref={innerRef} style={{ transform: `translateY(${offsets[start]}px)` }}>
        {rows}
      </div>
    </div>
  );
});

const INDENT_OPTIONS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tabs' },
];

const LANGUAGES = [
  { value: 'json', label: 'JSON', ext: 'json' },
  { value: 'javascript', label: 'JavaScript', ext: 'js' },
  { value: 'html', label: 'HTML', ext: 'html' },
  { value: 'css', label: 'CSS', ext: 'css' },
  { value: 'java', label: 'Java', ext: 'java' },
  { value: 'csharp', label: 'C#', ext: 'cs' },
  { value: 'python', label: 'Python', ext: 'py' },
  { value: 'sql', label: 'SQL', ext: 'sql' },
  { value: 'php', label: 'PHP', ext: 'php' },
  { value: 'c', label: 'C', ext: 'c' },
  { value: 'cpp', label: 'C++', ext: 'cpp' },
  { value: 'yaml', label: 'YML / YAML', ext: 'yaml' },
  { value: 'markdown', label: 'Markdown (MD)', ext: 'md' },
];

const basicIndenter = (code, unit) => {
  let indentLevel = 0;
  const lines = code.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const startsWithCloser = /^[})\]]/.test(line);
    if (startsWithCloser) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    out.push(unit.repeat(indentLevel) + line);

    const openCount = (line.match(/[{[(]/g) || []).length;
    const closeCount = (line.match(/[})\]]/g) || []).length;
    // The leading closer was already applied above
    indentLevel += openCount - closeCount + (startsWithCloser ? 1 : 0);
    indentLevel = Math.max(0, indentLevel);
  }
  return out.join('\n');
};

const SQL_DIALECTS = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'transactsql', label: 'SQL Server (T-SQL)' },
  { value: 'plsql', label: 'Oracle PL/SQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'spark', label: 'Spark SQL' },
  { value: 'trino', label: 'Trino / Presto' },
  { value: 'db2', label: 'IBM Db2' },
];

const SQL_KEYWORD_CASES = [
  { value: 'upper', label: 'KEYWORDS' },
  { value: 'lower', label: 'keywords' },
  { value: 'preserve', label: 'Keep case' },
];

const pythonFormatter = (code) => {
  return code
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const WORKER_HIGHLIGHT_CHARS = 100000;

/**
 * Per-line highlighted HTML. Small inputs are highlighted synchronously; large ones show
 * plain text at once and swap in Prism's output from a worker, so the page never freezes.
 */
function useHighlightedLines(code, language) {
  const offThread = code.length >= WORKER_HIGHLIGHT_CHARS && typeof Worker !== 'undefined';
  const syncLines = useMemo(
    () => (offThread ? plainLines(code) : highlightToLines(code, language)),
    [code, language, offThread]
  );
  const [workerResult, setWorkerResult] = useState(null);
  const workerRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (!offThread) return;
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(new URL('../utils/highlight.worker.js', import.meta.url), { type: 'module' });
      } catch {
        return;
      }
    }
    const worker = workerRef.current;
    const id = ++seqRef.current;
    const onMessage = (e) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      if (e.data.lines) setWorkerResult({ code, language, lines: e.data.lines });
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ id, code, language });
    return () => worker.removeEventListener('message', onMessage);
  }, [code, language, offThread]);

  return offThread && workerResult?.code === code && workerResult.language === language
    ? workerResult.lines
    : syncLines;
}

const CodeFormatter = () => {
  const [language, setLanguage] = useState('json');
  const [indent, setIndent] = useState('2');
  const [sqlDialect, setSqlDialect] = useState('sql');
  const [sqlKeywordCase, setSqlKeywordCase] = useState('upper');
  const [inputCode, setInputCode] = useState(defaultSampleCode.json);
  const [formattedCode, setFormattedCode] = useState(defaultSampleCode.json);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximize();

  // Find state: the query arrives already debounced from FindBar
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Code Folding states: object map of collapsed startLine index -> boolean
  const [collapsedFolds, setCollapsedFolds] = useState({});

  const scrollRef = useRef(null);
  const searchInputRef = useRef(null);

  const activeCode = formattedCode || inputCode;

  const foldRanges = useMemo(() => getFoldableRanges(activeCode, language), [activeCode, language]);
  const maxColumns = useMemo(() => getMaxColumns(activeCode), [activeCode]);

  // Syntax highlight once per code change, split into per-line HTML (off-thread for big files)
  const highlightedLines = useHighlightedLines(activeCode, language);

  // Line indices that are currently visible (collapsed ranges are skipped in one jump)
  const visibleLines = useMemo(() => {
    const out = [];
    for (let i = 0; i < highlightedLines.length; i++) {
      out.push(i);
      if (collapsedFolds[i] && foldRanges[i] > i) i = foldRanges[i];
    }
    return out;
  }, [highlightedLines, collapsedFolds, foldRanges]);

  // Plain-text search, line by line, producing per-line range arrays for the rows
  const { rangesByLine, matchesList } = useMemo(() => {
    const regex = buildSearchRegex(searchQuery, { matchCase });
    if (!regex || !activeCode) return { rangesByLine: new Map(), matchesList: [] };

    const lines = activeCode.split('\n');
    const byLine = new Map();
    const list = [];
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const keepGoing = scanLine(regex, lines[lineIdx], (start, end) => {
        const match = { idx: list.length, lineIdx, start, end };
        list.push(match);
        let arr = byLine.get(lineIdx);
        if (!arr) byLine.set(lineIdx, (arr = []));
        arr.push(match);
        return list.length < MAX_MATCHES;
      });
      if (!keepGoing) break;
    }
    return { rangesByLine: byLine, matchesList: list };
  }, [activeCode, searchQuery, matchCase]);

  const totalMatches = matchesList.length;
  const activeMatch = totalMatches > 0 ? matchesList[Math.min(currentMatchIndex, totalMatches - 1)] : null;

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, matchCase, activeCode]);

  // Reveal the active match: expand any collapsed fold that hides it
  useEffect(() => {
    if (!activeMatch) return;
    const target = activeMatch.lineIdx;
    const hiding = Object.keys(collapsedFolds).filter((key) => {
      const start = Number(key);
      return collapsedFolds[key] && target > start && target <= foldRanges[start];
    });
    if (hiding.length) {
      setCollapsedFolds((prev) => {
        const next = { ...prev };
        hiding.forEach((key) => { next[key] = false; });
        return next;
      });
    }
  }, [activeMatch, collapsedFolds, foldRanges]);

  const toggleFold = useCallback((startLine) => {
    setCollapsedFolds((prev) => ({ ...prev, [startLine]: !prev[startLine] }));
  }, []);

  const handleExpandAll = () => setCollapsedFolds({});

  const handleCollapseAll = () => {
    const all = {};
    Object.keys(foldRanges).forEach((line) => { all[line] = true; });
    setCollapsedFolds(all);
  };

  const handleNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const handlePrevMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  // Ctrl/Cmd+F inside the output panel focuses its find bar instead of the browser's
  const handlePanelKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) handlePrevMatch(); else handleNextMatch();
    }
  };

  const loadSample = (lang) => {
    const sample = defaultSampleCode[lang] || '';
    setInputCode(sample);
    setFormattedCode(sample);
    setError(null);
    setCollapsedFolds({});
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setError(null);
    setCollapsedFolds({});
    if (!inputCode.trim() || Object.values(defaultSampleCode).includes(inputCode)) {
      loadSample(newLang);
    }
  };

  const handleFormat = async (source = inputCode) => {
    setError(null);
    setCollapsedFolds({});
    if (!source.trim()) {
      setFormattedCode('');
      return true;
    }

    const unit = indent === 'tab' ? '\t' : ' '.repeat(Number(indent));
    setIsFormatting(true);
    try {
      let result = source;

      if (language === 'json') {
        result = JSON.stringify(JSON.parse(source), null, unit);
      } else if (['java', 'c', 'cpp', 'csharp', 'php'].includes(language)) {
        result = basicIndenter(source, unit);
      } else if (language === 'sql') {
        try {
          // Loaded on demand: the dialect grammars are only needed for SQL
          const { format: formatSql } = await import('sql-formatter');
          result = formatSql(source, {
            language: sqlDialect,
            tabWidth: indent === 'tab' ? 2 : Number(indent),
            useTabs: indent === 'tab',
            keywordCase: sqlKeywordCase,
            linesBetweenQueries: 1,
          });
        } catch (sqlErr) {
          // sql-formatter reports the line and column it could not parse
          throw new Error(sqlErr.message?.split('\n').slice(0, 2).join(' ') || 'could not parse the query');
        }
      } else if (language === 'python') {
        result = pythonFormatter(source);
      } else {
        const parserMap = { javascript: 'babel', html: 'html', css: 'css', yaml: 'yaml', markdown: 'markdown' };
        try {
          result = await prettier.format(source, {
            parser: parserMap[language] || 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginHtml, prettierPluginPostcss, prettierPluginMarkdown, prettierPluginYaml],
            singleQuote: true,
            tabWidth: indent === 'tab' ? 2 : Number(indent),
            useTabs: indent === 'tab',
            htmlWhitespaceSensitivity: 'ignore',
          });
        } catch (prettierErr) {
          console.warn('Prettier error, using basic indenter fallback:', prettierErr);
          setError({ type: 'warning', text: `Syntax warning: basic formatting applied. ${prettierErr.message?.split('\n')[0] || ''}` });
          result = basicIndenter(source, unit);
        }
      }

      setFormattedCode(result.replace(/\n$/, ''));
      return true;
    } catch (err) {
      setError({
        type: 'error',
        text: `Invalid ${language.toUpperCase()}: ${err.message || 'please check for syntax errors.'}`,
        canFix: Boolean(SYNTAX_FIXERS[language]),
      });
      return false;
    } finally {
      setIsFormatting(false);
    }
  };


  // Repairs common syntax mistakes (unquoted keys, trailing commas, unclosed tags…), then formats
  const handleFixSyntax = async () => {
    const fixer = SYNTAX_FIXERS[language];
    if (!fixer || !inputCode.trim()) return;
    let repaired;
    try {
      repaired = fixer(inputCode, indent === 'tab' ? '\t' : Number(indent));
    } catch (err) {
      setError({ type: 'error', text: `Could not repair this ${language.toUpperCase()}: ${err.message}` });
      return;
    }
    setInputCode(repaired.text);
    const ok = await handleFormat(repaired.text);
    if (!ok) return;
    setError({
      type: 'success',
      text: repaired.fixes.length
        ? `Fixed: ${repaired.fixes.join(', ')}.`
        : `Already valid ${language.toUpperCase()}; nothing to fix.`,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = LANGUAGES.find(l => l.value === language)?.ext || 'txt';
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formatted.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setInputCode('');
    setFormattedCode('');
    setError(null);
    setCollapsedFolds({});
  };

  // Ctrl/Cmd+Enter formats from anywhere on the page
  const formatRef = useRef(handleFormat);
  formatRef.current = handleFormat;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formatRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lineCount = highlightedLines.length;
  const foldCount = Object.keys(foldRanges).length;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Code Formatter"
        description="Beautify and highlight code in 13 languages, with dialect-aware SQL formatting. Fold blocks, find text instantly, and expand the output to full screen."
        icon={FileJson}
        color="var(--primary)"
      >
        <ShareHistory
          toolId="format"
          state={{ language, indent, input: inputCode, ...(language === 'sql' ? { sqlDialect } : {}) }}
          describe={(st) => `${st.language.toUpperCase()} · ${st.input.trim().replace(/\s+/g, ' ').slice(0, 60)}`}
          isEmpty={(st) => !st.input.trim() || Object.values(defaultSampleCode).includes(st.input)}
          onRestore={(st) => {
            if (LANGUAGES.some(l => l.value === st.language)) setLanguage(st.language);
            if (st.indent) setIndent(st.indent);
            if (st.sqlDialect) setSqlDialect(st.sqlDialect);
            setInputCode(st.input || '');
            setFormattedCode('');
            setError(null);
            setCollapsedFolds({});
          }}
        />
      </ToolHeader>

      {/* Controls Toolbar */}
      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <select className="form-select" value={language} onChange={(e) => handleLanguageChange(e.target.value)} aria-label="Language">
            {LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
          <select className="form-select" value={indent} onChange={(e) => setIndent(e.target.value)} aria-label="Indentation" style={{ minWidth: 120 }}>
            {INDENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {language === 'sql' && (
            <>
              <select className="form-select" value={sqlDialect} onChange={(e) => setSqlDialect(e.target.value)} aria-label="SQL dialect">
                {SQL_DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select className="form-select" value={sqlKeywordCase} onChange={(e) => setSqlKeywordCase(e.target.value)} aria-label="Keyword case" style={{ minWidth: 120 }}>
                {SQL_KEYWORD_CASES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => loadSample(language)} title="Load sample code">
            <RotateCcw size={15} /> <span>Sample</span>
          </button>
          <UploadButton
            label="Upload"
            className="btn btn-outline btn-sm"
            onFileLoaded={(res) => {
              setInputCode(res.content);
              if (res.detectedLanguage) setLanguage(res.detectedLanguage);
            }}
            onError={(msg) => setError({ type: 'error', text: msg })}
          />
          <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={handleClear} disabled={!inputCode && !formattedCode}>
            <Trash2 size={15} /> <span>Clear</span>
          </button>
        </div>

        <div className="tool-toolbar-group" style={{ width: 'auto' }}>
          {SYNTAX_FIXERS[language] && (
            <button
              className="btn btn-outline"
              onClick={handleFixSyntax}
              disabled={!inputCode || isFormatting}
              title="Repair common mistakes: unquoted keys, single quotes, trailing or missing commas, comments, unclosed brackets or tags"
            >
              <Wand2 size={16} />
              <span>Fix syntax</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => handleFormat()} disabled={!inputCode || isFormatting} title="Format (Ctrl+Enter)">
            <Play size={16} />
            <span>{isFormatting ? 'Formatting…' : 'Format Code'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className={`alert alert-${error.type}`}>
          {error.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{error.text}</span>
          {error.canFix && (
            <button className="btn btn-outline btn-xs" onClick={handleFixSyntax}>
              <Wand2 size={13} /> Fix syntax
            </button>
          )}
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="editor-split">
        {/* Left: Input */}
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Input <span className="badge-lang">{language.toUpperCase()}</span></span>
            <span className="text-xs text-muted">Drop a file or paste code</span>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea
              value={inputCode}
              onChange={(val) => setInputCode(val)}
              onFileLoaded={(res) => { if (res.detectedLanguage) setLanguage(res.detectedLanguage); }}
              placeholder="Paste or drag & drop code file here..."
              lineNumbers
              largeInputPreview
            />
          </div>
          <div className="code-panel-footer">
            <span>{inputCode ? inputCode.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{inputCode.length.toLocaleString()} chars</span>
          </div>
        </div>

        {/* Right: Formatted & highlighted output with find + folding */}
        <div className={`code-panel ${isMaximized ? 'is-maximized' : ''}`} onKeyDown={handlePanelKeyDown}>
          <div className="code-panel-header">
            <span className="code-panel-title">
              Output <span className="badge-lang">{language.toUpperCase()}</span>
            </span>

            <FindBar
              inputRef={searchInputRef}
              onQueryChange={setSearchQuery}
              total={totalMatches}
              current={currentMatchIndex}
              onNext={handleNextMatch}
              onPrev={handlePrevMatch}
              matchCase={matchCase}
              onToggleMatchCase={() => setMatchCase(v => !v)}
              placeholder="Find in output (Ctrl+F)"
            />

            <div className="code-panel-actions">
              {foldCount > 0 && (
                <>
                  <button className="btn btn-ghost btn-xs" onClick={handleExpandAll} title="Expand all">
                    <ChevronsUpDown size={15} /><span className="hide-mobile-text">Expand</span>
                  </button>
                  <button className="btn btn-ghost btn-xs" onClick={handleCollapseAll} title="Collapse all">
                    <ChevronsDownUp size={15} /><span className="hide-mobile-text">Collapse</span>
                  </button>
                </>
              )}
              <button className={`btn btn-ghost btn-xs ${wrapLines ? 'is-active' : ''}`} onClick={() => setWrapLines(v => !v)} title="Toggle word wrap" aria-pressed={wrapLines}>
                <WrapText size={15} />
              </button>
              <button className="btn btn-ghost btn-xs" onClick={handleCopy} disabled={!activeCode} title="Copy output">
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
              </button>
              <button className="btn btn-ghost btn-xs" onClick={handleDownload} disabled={!activeCode} title="Download output">
                <Download size={15} />
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setIsMaximized(v => !v)} title={isMaximized ? 'Exit full screen (Esc)' : 'Full screen'}>
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          <div className="code-panel-body">
            <div ref={scrollRef} className={`code-view-scroll ${wrapLines ? 'wrap' : ''}`} tabIndex={0}>
              {activeCode ? (
                <VirtualCodeLines
                  scrollRef={scrollRef}
                  className={`code-view-lines language-${languagePrismMap[language] || 'javascript'}`}
                  wrap={wrapLines}
                  maxColumns={maxColumns}
                  activeMatch={activeMatch}
                  visibleLines={visibleLines}
                  highlightedLines={highlightedLines}
                  foldRanges={foldRanges}
                  collapsedFolds={collapsedFolds}
                  rangesByLine={rangesByLine}
                  toggleFold={toggleFold}
                />
              ) : (
                <div className="text-muted p-4 text-sm">Formatted output will appear here…</div>
              )}
            </div>
          </div>
          <div className="code-panel-footer">
            <span>{lineCount.toLocaleString()} lines{totalMatches > 0 ? ` · ${totalMatches.toLocaleString()} matches` : ''}</span>
            <span>{activeCode.length.toLocaleString()} chars</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeFormatter;
