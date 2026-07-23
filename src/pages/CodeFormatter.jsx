import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ToolHeader from '../components/ToolHeader';
import { FileJson, Play, Copy, Check, Maximize2, X, RotateCcw, Search, ChevronUp, ChevronDown } from 'lucide-react';
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
  html: '<div class="container"><h1>Hello World</h1><p>Welcome to DevTools</p></div>',
  css: 'body{background-color:#0a0a0e;color:#fff;margin:0;}h1{font-size:2rem;}',
  java: 'public class Main{\npublic static void main(String[] args){\nSystem.out.println("Hello Java");\n}\n}',
  csharp: 'namespace HelloApp{\nclass Program{\nstatic void Main(string[] args){\nConsole.WriteLine("Hello C#");\n}\n}\n}',
  python: 'def process_data(items):\n  result=[x*2 for x in items if x>0]\n  return result\n',
  sql: 'SELECT id, name, email, created_at FROM users WHERE status=\'active\' ORDER BY created_at DESC;',
  php: '<?php\n$user = ["name" => "John", "role" => "Admin"];\necho json_encode($user);\n?>',
  c: '#include <stdio.h>\nint main() {\n  printf("Hello, C World!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\nint main() {\n  std::cout << "Hello C++" << std::endl;\n  return 0;\n}',
  yaml: 'server:\n  port: 8080\n  environment: production\n  tags:\n    - web\n    - api',
  markdown: '# Title\n\n- Feature 1\n- Feature 2\n\n**Bold text** and *italic text*.'
};

const CodeFormatter = () => {
  usePageTitle('Code Formatter');
  const [language, setLanguage] = useState('json');
  const [inputCode, setInputCode] = useState(defaultSampleCode.json);
  const [formattedCode, setFormattedCode] = useState(defaultSampleCode.json);
  const [copied, setCopied] = useState(false);
  const [fullscreenCopied, setFullscreenCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Search feature states for full screen mode
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const codeRef = useRef(null);
  const modalCodeRef = useRef(null);
  const searchInputRef = useRef(null);

  // Syntax highlighting for split preview
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [formattedCode, language]);

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false);
    setSearchQuery('');
    setTotalMatches(0);
    setCurrentMatchIndex(0);
  }, []);

  // Lock body scrolling when Full Screen modal is open to ensure only 1 single scrollbar exists
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  // Handle DOM Search Highlighting
  useEffect(() => {
    if (!isFullScreen || !modalCodeRef.current) return;

    const container = modalCodeRef.current;
    
    // Re-run Prism highlight on modal container
    Prism.highlightElement(container);

    if (!searchQuery.trim()) {
      requestAnimationFrame(() => {
        setTotalMatches(0);
        setCurrentMatchIndex(0);
      });
      return;
    }

    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    const textNodes = [];
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walk.nextNode())) {
      textNodes.push(node);
    }

    const createdMarks = [];

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      if (!text) return;

      let match;
      regex.lastIndex = 0;
      const matchesInNode = [];

      while ((match = regex.exec(text)) !== null) {
        matchesInNode.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        });
      }

      if (matchesInNode.length > 0) {
        const parent = textNode.parentNode;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;

        matchesInNode.forEach((m) => {
          if (m.index > lastIdx) {
            frag.appendChild(document.createTextNode(text.substring(lastIdx, m.index)));
          }

          const mark = document.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = m.text;
          frag.appendChild(mark);
          createdMarks.push(mark);

          lastIdx = m.index + m.length;
        });

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIdx)));
        }

        parent.replaceChild(frag, textNode);
      }
    });

    const count = createdMarks.length;

    requestAnimationFrame(() => {
      setTotalMatches(count);
      if (count > 0) {
        const validIndex = Math.min(Math.max(0, currentMatchIndex), count - 1);
        if (validIndex !== currentMatchIndex) {
          setCurrentMatchIndex(validIndex);
        }
        if (createdMarks[validIndex]) {
          createdMarks[validIndex].classList.add('search-match-active');
          createdMarks[validIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setCurrentMatchIndex(0);
      }
    });
  }, [searchQuery, currentMatchIndex, isFullScreen, formattedCode, language]);

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
    if (!inputCode.trim() || Object.values(defaultSampleCode).includes(inputCode)) {
      const sample = defaultSampleCode[newLang] || '';
      setInputCode(sample);
      setFormattedCode(sample);
    }
  };

  const handleFormat = async () => {
    try {
      setError(null);
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
        {/* Controls Toolbar */}
        <div className="flex justify-between items-center mb-4 block-mobile">
          <div className="flex items-center gap-3">
            <div className="form-group mb-0" style={{ width: '220px' }}>
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
              className="btn btn-ghost" 
              onClick={() => {
                const sample = defaultSampleCode[language] || '';
                setInputCode(sample);
                setFormattedCode(sample);
                setError(null);
              }}
              title="Reset Sample Code"
            >
              <RotateCcw size={16} /> Sample
            </button>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-outline" onClick={() => handleCopy(false)} disabled={!formattedCode && !inputCode}>
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn-primary" onClick={handleFormat} disabled={!inputCode}>
              <Play size={18} />
              Format Code
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
          {/* Left: Input Textarea */}
          <div className="code-editor-container">
            <div className="code-editor-header">
              <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Raw Input</span>
              <span className="badge-lang">{language.toUpperCase()}</span>
            </div>
            <div className="code-editor-body">
              <textarea
                className="code-textarea"
                placeholder="Paste code here..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                spellCheck="false"
                style={{ minHeight: '55vh' }}
              />
            </div>
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

      {/* Full Screen View Overlay - Rendered via React Portal directly into document.body to cover main Navbar & full screen */}
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

            {/* Find Text Search Bar (Middle on Desktop, full width 2nd row on Mobile) */}
            <div className="fullscreen-search-bar">
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input"
                  placeholder="Find text (Enter / Shift+Enter)..."
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

            {/* Action Buttons (Always 100% visible on right) */}
            <div className="fullscreen-actions">
              <button className="btn btn-outline btn-sm" onClick={() => handleCopy(true)}>
                {fullscreenCopied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                <span>{fullscreenCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <button className="btn btn-ghost btn-sm close-modal-btn" onClick={closeFullScreen} title="Close Fullscreen (Esc)">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Full Screen Code Body - ONLY 1 SCROLLBAR ON SCREEN */}
          <div className="fullscreen-code-body p-6">
            <pre style={{ margin: 0, background: 'transparent', fontFamily: 'var(--font-mono)' }}>
              <code ref={modalCodeRef} className={prismLangClass}>
                {formattedCode || inputCode}
              </code>
            </pre>
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

        /* Full Screen Cover Styling - Portal to <body> guarantees covering site Navbar */
        .fullscreen-overlay-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          max-width: 100%;
          max-height: 100%;
          background: #0a0a0f;
          z-index: 999999; /* Higher than Navbar z-index: 50 */
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
          gap: 0.5rem;
          flex-shrink: 0; /* Ensures Copy and Close buttons NEVER shrink or hide */
        }

        .fullscreen-code-body {
          flex: 1;
          overflow: auto; /* ONLY 1 SCROLLBAR FOR FULL PAGE */
          background: #090a0e;
        }

        /* Search Bar in Full View Header */
        .fullscreen-search-bar {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-medium);
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex: 1;
          max-width: 400px;
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

        /* Highlight Search Matches */
        mark.search-match {
          background-color: rgba(245, 158, 11, 0.45);
          color: #ffffff;
          border-radius: 2px;
          padding: 0 2px;
        }

        mark.search-match-active {
          background-color: #f59e0b !important;
          color: #000000 !important;
          font-weight: bold;
          outline: 2px solid #6366f1;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.9);
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
            gap: 1rem;
            align-items: stretch !important;
          }

          .block-mobile > div:first-child {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CodeFormatter;
