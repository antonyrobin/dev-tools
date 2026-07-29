import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { FileJson, Play, Copy, Check, Maximize2, X, RotateCcw, Search, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import * as prettier from 'prettier/standalone';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import prettierPluginPostcss from 'prettier/plugins/postcss';
import prettierPluginMarkdown from 'prettier/plugins/markdown';
import prettierPluginYaml from 'prettier/plugins/yaml';
import usePageTitle from '../hooks/usePageTitle';

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
  sql: 'SELECT id, name, email, created_at FROM users WHERE status=\'active\' ORDER BY created_at DESC;',
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
 * Ultra-fast string-based line HTML search highlight (zero DOM template allocation overhead)
 * Handles special characters like :, -, * safely via regex lookahead outside HTML tags.
 */
function highlightLineHtml(lineHtml, lineMatches, activeMatchIdx) {
  if (!lineHtml || !lineMatches || lineMatches.length === 0) return lineHtml;

  let resultHtml = lineHtml;

  lineMatches.forEach(m => {
    const queryText = m.text;
    if (!queryText) return;
    const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
    const isActive = m.matchIndex === activeMatchIdx;
    const markClass = isActive ? 'search-match search-match-active' : 'search-match';
    
    resultHtml = resultHtml.replace(regex, (matchText) => {
      return `<mark class="${markClass}" data-match-idx="${m.matchIndex}">${matchText}</mark>`;
    });
  });

  return resultHtml;
}

/**
 * Memoized Code Line Component to prevent un-needed line re-renders during search navigation
 */
const CodeLineRow = React.memo(({ lineHtml, lineIdx, isHidden, hasFold, isCollapsed, collapsedCount, lineMatches, currentMatchIndex, toggleFold }) => {
  if (isHidden) return null;

  const finalHtml = lineMatches ? highlightLineHtml(lineHtml, lineMatches, currentMatchIndex) : lineHtml;

  return (
    <div id={`code-line-${lineIdx}`} className="code-line-row flex items-start">
      {/* Line Number & Code Folding Gutter */}
      <div className="code-fold-gutter flex items-center justify-end">
        <span className="line-num-text">{lineIdx + 1}</span>
        {hasFold && (
          <button
            className="fold-btn"
            onClick={() => toggleFold(lineIdx)}
            title={isCollapsed ? "Click to expand the range." : "Click to collapse the range."}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Syntax Highlighted Line Content */}
      <div className="code-line-content flex-1 flex items-center flex-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        <span dangerouslySetInnerHTML={{ __html: finalHtml || ' ' }} />

        {/* Collapsed Indicator Badge */}
        {hasFold && isCollapsed && (
          <span
            className="collapsed-preview-badge"
            onClick={() => toggleFold(lineIdx)}
            title="Click to expand the range."
          >
            ... {collapsedCount} lines
          </span>
        )}
      </div>
    </div>
  );
});

const CodeFormatter = () => {
  usePageTitle('Code Formatter');
  const [language, setLanguage] = useState('json');
  const [inputCode, setInputCode] = useState(defaultSampleCode.json);
  const [formattedCode, setFormattedCode] = useState(defaultSampleCode.json);
  const [copied, setCopied] = useState(false);
  const [fullscreenCopied, setFullscreenCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Search feature states with 200ms debounce
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Code Folding states: object map of collapsed startLine index -> boolean
  const [collapsedFolds, setCollapsedFolds] = useState({});

  const codeRef = useRef(null);
  const modalCodeRef = useRef(null);
  const searchInputRef = useRef(null);

  // Debounce search query input to eliminate freezing on large code
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Highlight preview in split view
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [formattedCode, language]);

  // Compute fold ranges for current code
  const activeCode = formattedCode || inputCode;
  const foldRanges = useMemo(() => {
    return getFoldableRanges(activeCode, language);
  }, [activeCode, language]);

  // High performance hidden lines lookup set: O(1) per line render check instead of O(N*F)
  const hiddenLinesSet = useMemo(() => {
    const hidden = new Set();
    for (const [startStr, isCollapsed] of Object.entries(collapsedFolds)) {
      if (!isCollapsed) continue;
      const start = Number(startStr);
      const end = foldRanges[start];
      if (end && end > start) {
        for (let i = start + 1; i <= end; i++) {
          hidden.add(i);
        }
      }
    }
    return hidden;
  }, [collapsedFolds, foldRanges]);

  // Prism highlighted line HTMLs for full screen view
  const highlightedLines = useMemo(() => {
    const prismLang = languagePrismMap[language] || 'javascript';
    const grammar = Prism.languages[prismLang] || Prism.languages.javascript;
    const highlightedHtml = Prism.highlight(activeCode, grammar, prismLang);
    return splitPrismHtmlIntoLines(highlightedHtml);
  }, [activeCode, language]);

  // Compute search matches per line with fast data-driven regex
  const { lineMatchesMap, matchesList } = useMemo(() => {
    if (!debouncedSearchQuery.trim() || !activeCode) {
      return { lineMatchesMap: {}, matchesList: [] };
    }

    const query = debouncedSearchQuery;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex;
    try {
      regex = new RegExp(escaped, 'gi');
    } catch {
      return { lineMatchesMap: {}, matchesList: [] };
    }

    const lines = activeCode.split('\n');
    const lineMatchesMap = {};
    const matchesList = [];
    let matchCounter = 0;

    lines.forEach((lineText, lineIdx) => {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(lineText)) !== null) {
        if (m[0].length === 0) { regex.lastIndex++; continue; }
        const matchObj = {
          matchIndex: matchCounter++,
          lineIdx,
          startCol: m.index,
          endCol: m.index + m[0].length,
          text: m[0]
        };
        if (!lineMatchesMap[lineIdx]) lineMatchesMap[lineIdx] = [];
        lineMatchesMap[lineIdx].push(matchObj);
        matchesList.push(matchObj);
      }
    });

    return { lineMatchesMap, matchesList };
  }, [activeCode, debouncedSearchQuery]);

  const totalMatches = matchesList.length;

  // Reset search match index on query or code changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [debouncedSearchQuery, activeCode]);

  // Auto-expand fold if search match is hidden inside it, and scroll into view
  useEffect(() => {
    if (totalMatches === 0) return;
    const validIdx = Math.min(Math.max(0, currentMatchIndex), totalMatches - 1);
    const activeMatch = matchesList[validIdx];

    if (activeMatch) {
      const targetLine = activeMatch.lineIdx;
      setCollapsedFolds((prevFolds) => {
        let needsUpdate = false;
        const nextFolds = { ...prevFolds };
        Object.entries(nextFolds).forEach(([startStr, isCollapsed]) => {
          if (!isCollapsed) return;
          const start = Number(startStr);
          const end = foldRanges[start];
          if (end && targetLine > start && targetLine <= end) {
            nextFolds[start] = false;
            needsUpdate = true;
          }
        });
        return needsUpdate ? nextFolds : prevFolds;
      });

      requestAnimationFrame(() => {
        const markEl = document.querySelector(`mark[data-match-idx="${validIdx}"]`);
        if (markEl) {
          markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const lineEl = document.getElementById(`code-line-${targetLine}`);
          if (lineEl) {
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }
  }, [currentMatchIndex, totalMatches, matchesList, foldRanges]);

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
  }, []);

  // Lock body scrolling on Full Screen
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isFullScreen]);

  // Toggle single fold range
  const toggleFold = useCallback((startLine) => {
    setCollapsedFolds((prev) => ({
      ...prev,
      [startLine]: !prev[startLine],
    }));
  }, []);

  // Expand all sections
  const handleExpandAll = () => {
    setCollapsedFolds({});
  };

  // Collapse all sections
  const handleCollapseAll = () => {
    const all = {};
    Object.keys(foldRanges).forEach((line) => {
      all[line] = true;
    });
    setCollapsedFolds(all);
  };

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === 'Escape') {
      if (searchQuery) {
        e.stopPropagation();
        setSearchQuery('');
      } else {
        closeFullScreen();
      }
    }
  };

  const basicIndenter = (code) => {
    let indentLevel = 0;
    const lines = code.split('\n');
    const out = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.match(/^[})]/)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      out.push('  '.repeat(indentLevel) + line);

      const openCount = (line.match(/[{[(]/g) || []).length;
      const closeCount = (line.match(/[})]/g) || []).length;
      indentLevel += (openCount - closeCount);
      indentLevel = Math.max(0, indentLevel);
    }
    return out.join('\n');
  };

  const sqlFormatter = (code) => {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|LEFT JOIN|RIGHT JOIN|INNER JOIN|LIMIT|HAVING|INSERT|UPDATE|DELETE|SET|VALUES)\b/gi, '\n$1')
      .replace(/^\s*\n/gm, '')
      .trim();
  };

  const pythonFormatter = (code) => {
    return code
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setError(null);
    setCollapsedFolds({});
    if (!inputCode.trim() || Object.values(defaultSampleCode).includes(inputCode)) {
      const sample = defaultSampleCode[newLang] || '';
      setInputCode(sample);
      setFormattedCode(sample);
    }
  };

  const handleFormat = async () => {
    try {
      setError(null);
      setCollapsedFolds({});
      if (!inputCode.trim()) {
        setFormattedCode('');
        return;
      }

      let result = inputCode;

      if (language === 'json') {
        const parsed = JSON.parse(inputCode);
        result = JSON.stringify(parsed, null, 2);
      } 
      else if (['java', 'c', 'cpp', 'csharp', 'php'].includes(language)) {
        result = basicIndenter(inputCode);
      }
      else if (language === 'sql') {
        result = sqlFormatter(inputCode);
      }
      else if (language === 'python') {
        result = pythonFormatter(inputCode);
      }
      else {
        const parserMap = {
          javascript: 'babel',
          html: 'html',
          css: 'css',
          yaml: 'yaml',
          markdown: 'markdown'
        };
        const plugins = [
          prettierPluginBabel, 
          prettierPluginEstree, 
          prettierPluginHtml, 
          prettierPluginPostcss, 
          prettierPluginMarkdown, 
          prettierPluginYaml
        ];
        
        try {
          result = await prettier.format(inputCode, {
            parser: parserMap[language] || 'babel',
            plugins: plugins,
            singleQuote: true,
            htmlWhitespaceSensitivity: 'ignore'
          });
        } catch (prettierErr) {
          console.warn("Prettier error, using basic indenter fallback:", prettierErr);
          setError("Syntax warning: Basic formatting applied.");
          result = basicIndenter(inputCode);
        }
      }

      setFormattedCode(result);
    } catch {
      setError('Invalid code format. Please check for syntax errors.');
    }
  };

  const handleCopy = (isModal = false) => {
    const textToCopy = formattedCode || inputCode;
    navigator.clipboard.writeText(textToCopy);
    if (isModal) {
      setFullscreenCopied(true);
      setTimeout(() => setFullscreenCopied(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen && !searchQuery) {
        closeFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, searchQuery, closeFullScreen]);

  const languages = [
    { value: 'json', label: 'JSON' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'python', label: 'Python' },
    { value: 'sql', label: 'SQL' },
    { value: 'php', label: 'PHP' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'yaml', label: 'YML / YAML' },
    { value: 'markdown', label: 'Markdown (MD)' },
  ];

  const prismLangClass = `language-${languagePrismMap[language] || 'javascript'}`;

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Formatter" 
        description="Clean, beautify, and highlight your code across multiple languages with full precision."
        icon={FileJson}
        color="var(--primary)"
      />

      <div className="glass-card p-6" style={{ padding: '1.5rem' }}>
        {/* Responsive Controls Toolbar */}
        <div className="flex justify-between items-center mb-4 block-mobile gap-3">
          <div className="tool-controls-bar">
            <div className="form-group mb-0" style={{ minWidth: '140px', flex: '1 1 auto' }}>
              <select 
                className="form-select"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => {
                const sample = defaultSampleCode[language] || '';
                setInputCode(sample);
                setFormattedCode(sample);
                setError(null);
                setCollapsedFolds({});
              }}
              title="Reset Sample Code"
            >
              <RotateCcw size={16} /> <span>Sample</span>
            </button>
            <UploadButton 
              label="Upload"
              className="btn btn-outline btn-sm"
              onFileLoaded={(res) => {
                setInputCode(res.content);
                if (res.detectedLanguage) {
                  setLanguage(res.detectedLanguage);
                }
              }}
            />
            <button className="btn btn-outline btn-sm" onClick={() => handleCopy(false)} disabled={!formattedCode && !inputCode}>
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex items-center w-full-mobile">
            <button className="btn btn-primary btn-lg mobile-full-btn" onClick={handleFormat} disabled={!inputCode}>
              <Play size={18} />
              <span>Format Code</span>
            </button>
          </div>
        </div>


        {error && (
          <div className="mb-4 p-3 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Split View Editor & Color-Coded Highlighted Output */}
        <div className="formatter-split-grid">
          {/* Left: Input Textarea Container */}
          <div className="code-editor-container flex flex-col">
            <div className="code-editor-header flex justify-between items-center">
              <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Raw Input</span>
              <span className="badge-lang">{language.toUpperCase()}</span>
            </div>
            <CodeDropzoneTextarea
              value={inputCode}
              onChange={(val) => setInputCode(val)}
              onFileLoaded={(res) => {
                if (res.detectedLanguage) {
                  setLanguage(res.detectedLanguage);
                }
              }}
              placeholder="Paste or drag & drop code file here..."
              style={{ minHeight: '55vh' }}
            />
          </div>

          {/* Right: Formatted & Color Coded Output */}
          <div className="code-editor-container">
            <div className="code-editor-header flex justify-between items-center">
              <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Formatted & Highlighted Output</span>
              
              <button 
                className="btn btn-ghost btn-sm flex items-center gap-1"
                onClick={() => setIsFullScreen(true)}
                title="Full Screen View"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              >
                <Maximize2 size={15} />
                <span>Full Screen</span>
              </button>
            </div>
            <div className="code-editor-body highlighted-output-scroll" style={{ minHeight: '55vh', maxHeight: '55vh', overflow: 'auto', padding: '1rem', background: '#14151f' }}>
              <pre style={{ margin: 0, background: 'transparent' }}>
                <code ref={codeRef} className={prismLangClass}>
                  {formattedCode || inputCode || '// Formatted output will appear here...'}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen View Overlay - Rendered via React Portal */}
      {isFullScreen && createPortal(
        <div className="fullscreen-overlay-page">
          <div className="fullscreen-header">
            {/* Title Section */}
            <div className="fullscreen-title-area">
              <FileJson size={20} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                Formatted View <span className="badge-lang ml-1">{language.toUpperCase()}</span>
              </span>
            </div>

            {/* Expand / Collapse All & Search Bar */}
            <div className="fullscreen-search-bar">
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input"
                  placeholder="Find text (e.g. &quot;version&quot;:)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Match Count Indicator */}
              <div className="search-count-badge">
                {totalMatches > 0 ? (
                  <span>{currentMatchIndex + 1}/{totalMatches}</span>
                ) : searchQuery ? (
                  <span className="text-muted">0/0</span>
                ) : (
                  <span className="text-muted">Find</span>
                )}
              </div>

              {/* Navigation Up & Down Arrows */}
              <div className="flex items-center gap-1">
                <button 
                  className="btn btn-ghost btn-xs search-nav-btn"
                  onClick={handlePrevMatch}
                  disabled={totalMatches === 0}
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp size={15} />
                </button>
                <button 
                  className="btn btn-ghost btn-xs search-nav-btn"
                  onClick={handleNextMatch}
                  disabled={totalMatches === 0}
                  title="Next match (Enter)"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>

            {/* Action Buttons: Expand/Collapse All, Copy, Close */}
            <div className="fullscreen-actions">
              <button 
                className="btn btn-outline btn-sm fold-control-btn"
                onClick={handleExpandAll}
                title="Expand all collapsible ranges"
              >
                <ChevronsUpDown size={15} />
                <span className="hide-mobile-text">Expand All</span>
              </button>
              <button 
                className="btn btn-outline btn-sm fold-control-btn"
                onClick={handleCollapseAll}
                title="Collapse all sections"
              >
                <ChevronsDownUp size={15} />
                <span className="hide-mobile-text">Collapse All</span>
              </button>

              <button className="btn btn-outline btn-sm" onClick={() => handleCopy(true)}>
                {fullscreenCopied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                <span>{fullscreenCopied ? 'Copied' : 'Copy'}</span>
              </button>

              <button className="btn btn-ghost btn-sm close-modal-btn" onClick={closeFullScreen} title="Close Fullscreen (Esc)">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Full Screen Code Body with Line Gutter & Collapsible Ranges */}
          <div className="fullscreen-code-body p-6" ref={modalCodeRef}>
            <div className="code-lines-container font-mono text-sm" style={{ lineHeight: '1.6', background: '#090a0e' }}>
              {highlightedLines.map((lineHtml, lineIdx) => {
                const hasFold = foldRanges[lineIdx] !== undefined;
                const isCollapsed = Boolean(collapsedFolds[lineIdx]);
                const collapsedEnd = foldRanges[lineIdx];
                const collapsedCount = collapsedEnd ? collapsedEnd - lineIdx : 0;
                const isHidden = hiddenLinesSet.has(lineIdx);
                const lineMatches = lineMatchesMap[lineIdx];

                return (
                  <CodeLineRow
                    key={lineIdx}
                    lineHtml={lineHtml}
                    lineIdx={lineIdx}
                    isHidden={isHidden}
                    hasFold={hasFold}
                    isCollapsed={isCollapsed}
                    collapsedCount={collapsedCount}
                    lineMatches={lineMatches}
                    currentMatchIndex={currentMatchIndex}
                    toggleFold={toggleFold}
                  />
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .formatter-split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .badge-lang {
          background: rgba(99, 102, 241, 0.15);
          color: var(--primary);
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .fullscreen-overlay-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          background: #0a0a0f;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .fullscreen-header {
          flex-shrink: 0;
          background: #12131c;
          border-bottom: 1px solid var(--border-light);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          padding: 0.6rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }

        .fullscreen-title-area {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .fullscreen-actions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-shrink: 0;
        }

        .fullscreen-code-body {
          flex: 1;
          overflow: auto;
          background: #090a0e;
        }

        .fullscreen-search-bar {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-medium);
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex: 1;
          max-width: 420px;
          box-sizing: border-box;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 80px;
        }

        .search-icon {
          position: absolute;
          left: 0.4rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          padding: 0.3rem 1.6rem 0.3rem 1.8rem;
          font-size: 0.85rem;
          width: 100%;
          outline: none;
          font-family: inherit;
        }

        .search-clear-btn {
          position: absolute;
          right: 0.3rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .search-clear-btn:hover {
          color: var(--text-primary);
        }

        .search-count-badge {
          font-size: 0.78rem;
          font-weight: 600;
          min-width: 45px;
          text-align: center;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .search-nav-btn {
          padding: 0.2rem;
          border-radius: var(--radius-sm);
        }

        .code-line-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        /* Responsive Layout for Mobile and Tablet (<820px) */
        @media (max-width: 820px) {
          .fullscreen-header {
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "title actions"
              "search search";
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
          }

          .fullscreen-title-area {
            grid-area: title;
          }

          .fullscreen-actions {
            grid-area: actions;
          }

          .fullscreen-search-bar {
            grid-area: search;
            max-width: 100%;
            width: 100%;
          }

          .formatter-split-grid {
            grid-template-columns: 1fr;
          }

          .block-mobile {
            flex-direction: column;
            gap: 0.75rem;
            align-items: stretch !important;
          }

          .hide-mobile-text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default CodeFormatter;
