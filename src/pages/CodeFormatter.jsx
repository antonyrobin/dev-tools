import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ToolHeader from '../components/ToolHeader';
import FindBar from '../components/FindBar';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { FileJson, Play, Copy, Check, Maximize2, Minimize2, RotateCcw, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp, WrapText, Download, Trash2, AlertTriangle } from 'lucide-react';
import * as prettier from 'prettier/standalone';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import prettierPluginPostcss from 'prettier/plugins/postcss';
import prettierPluginMarkdown from 'prettier/plugins/markdown';
import prettierPluginYaml from 'prettier/plugins/yaml';
import ShareHistory from '../components/ShareHistory';
import usePageTitle from '../hooks/usePageTitle';
import useMaximize from '../hooks/useMaximize';
import { buildSearchRegex, scanLine, highlightHtmlRanges, MAX_MATCHES } from '../utils/textSearch';

// Import Prism core and themes
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// Import language components statically for Cloudflare production bundle safety
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

const languagePrismMap = {
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

/**
 * Splits Prism syntax-highlighted HTML string into individual line HTML strings,
 * properly closing and re-opening open HTML span tags across newline boundaries.
 */
function splitPrismHtmlIntoLines(html) {
  if (!html) return [];
  const lines = [];
  let currentLine = '';
  const openTags = [];

  let i = 0;
  while (i < html.length) {
    if (html[i] === '\n') {
      let closedTags = '';
      for (let t = openTags.length - 1; t >= 0; t--) {
        closedTags += '</span>';
      }
      lines.push(currentLine + closedTags);

      let reopenedTags = '';
      for (let t = 0; t < openTags.length; t++) {
        reopenedTags += openTags[t];
      }
      currentLine = reopenedTags;
      i++;
    } else if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i);
      if (tagEnd !== -1) {
        const tag = html.substring(i, tagEnd + 1);
        if (tag.startsWith('</')) {
          openTags.pop();
        } else if (!tag.endsWith('/>') && !tag.startsWith('<?')) {
          openTags.push(tag);
        }
        currentLine += tag;
        i = tagEnd + 1;
      } else {
        currentLine += html[i];
        i++;
      }
    } else {
      currentLine += html[i];
      i++;
    }
  }
  lines.push(currentLine);
  return lines;
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

/** The whole line list; memoized so parent updates (e.g. match counter) skip it. */
const CodeLines = React.memo(({ visibleLines, highlightedLines, foldRanges, collapsedFolds, rangesByLine, toggleFold, className }) => (
  <div className={className}>
    {visibleLines.map((lineIdx) => {
      const foldEnd = foldRanges[lineIdx];
      return (
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
    })}
  </div>
));

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

const CodeFormatter = () => {
  usePageTitle('Code Formatter');
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

  // Syntax highlight once per code change, then split into per-line HTML
  const highlightedLines = useMemo(() => {
    const prismLang = languagePrismMap[language] || 'javascript';
    const grammar = Prism.languages[prismLang] || Prism.languages.javascript;
    return splitPrismHtmlIntoLines(Prism.highlight(activeCode, grammar, prismLang));
  }, [activeCode, language]);

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

  // Mark the active match directly in the DOM and scroll the viewer (not the page) to it.
  // Re-runs when the rendered lines change so the highlight survives re-renders.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.querySelectorAll('.search-match-active').forEach((el) => el.classList.remove('search-match-active'));
    container.querySelectorAll('.has-active-match').forEach((el) => el.classList.remove('has-active-match'));
    if (!activeMatch) return;

    const mark = container.querySelector(`mark[data-match-idx="${activeMatch.idx}"]`);
    if (!mark) return;
    mark.classList.add('search-match-active');
    const row = mark.closest('.code-line-row');
    row.classList.add('has-active-match');

    container.scrollTop = row.offsetTop - container.clientHeight / 2 + row.offsetHeight / 2;
    if (!wrapLines) {
      const gutter = 80;
      const left = mark.offsetLeft;
      if (left < container.scrollLeft + gutter || left + mark.offsetWidth > container.scrollLeft + container.clientWidth - 24) {
        container.scrollLeft = Math.max(0, left - container.clientWidth / 2);
      }
    }
  }, [activeMatch, rangesByLine, visibleLines, wrapLines]);

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

  const handleFormat = async () => {
    setError(null);
    setCollapsedFolds({});
    if (!inputCode.trim()) {
      setFormattedCode('');
      return;
    }

    const unit = indent === 'tab' ? '\t' : ' '.repeat(Number(indent));
    setIsFormatting(true);
    try {
      let result = inputCode;

      if (language === 'json') {
        result = JSON.stringify(JSON.parse(inputCode), null, unit);
      } else if (['java', 'c', 'cpp', 'csharp', 'php'].includes(language)) {
        result = basicIndenter(inputCode, unit);
      } else if (language === 'sql') {
        try {
          // Loaded on demand: the dialect grammars are only needed for SQL
          const { format: formatSql } = await import('sql-formatter');
          result = formatSql(inputCode, {
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
        result = pythonFormatter(inputCode);
      } else {
        const parserMap = { javascript: 'babel', html: 'html', css: 'css', yaml: 'yaml', markdown: 'markdown' };
        try {
          result = await prettier.format(inputCode, {
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
          result = basicIndenter(inputCode, unit);
        }
      }

      setFormattedCode(result.replace(/\n$/, ''));
    } catch (err) {
      setError({ type: 'error', text: `Invalid ${language.toUpperCase()}: ${err.message || 'please check for syntax errors.'}` });
    } finally {
      setIsFormatting(false);
    }
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

        <button className="btn btn-primary" onClick={handleFormat} disabled={!inputCode || isFormatting} title="Format (Ctrl+Enter)">
          <Play size={16} />
          <span>{isFormatting ? 'Formatting…' : 'Format Code'}</span>
        </button>
      </div>

      {error && (
        <div className={`alert alert-${error.type}`}>
          <AlertTriangle size={16} />
          <span>{error.text}</span>
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
                <CodeLines
                  className={`code-view-lines language-${languagePrismMap[language] || 'javascript'}`}
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
