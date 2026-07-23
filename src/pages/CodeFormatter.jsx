import React, { useState, useEffect, useRef } from 'react';
import ToolHeader from '../components/ToolHeader';
import { FileJson, Play, Copy, Check, Maximize2, Minimize2, X, RotateCcw } from 'lucide-react';
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
  // Requirement I.1: Default code language should be selected as JSON
  const [language, setLanguage] = useState('json');
  const [inputCode, setInputCode] = useState(defaultSampleCode.json);
  const [formattedCode, setFormattedCode] = useState(defaultSampleCode.json);
  const [copied, setCopied] = useState(false);
  const [fullscreenCopied, setFullscreenCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const codeRef = useRef(null);
  const modalCodeRef = useRef(null);

  // Requirement I.2: Color codes applied for all languages via Prism
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
    if (modalCodeRef.current) {
      Prism.highlightElement(modalCodeRef.current);
    }
  }, [formattedCode, language, isFullScreen]);

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
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

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
              
              {/* Requirement I.3: Fullscreen View Option */}
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

      {/* Requirement I.3: Full Screen Modal Overlay */}
      {isFullScreen && (
        <div className="fullscreen-modal-backdrop" onClick={() => setIsFullScreen(false)}>
          <div className="fullscreen-modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-modal-header flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <FileJson size={24} style={{ color: 'var(--primary)' }} />
                <h3 className="mb-0" style={{ fontSize: '1.25rem' }}>Formatted Code View ({language.toUpperCase()})</h3>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn btn-outline btn-sm" onClick={() => handleCopy(true)}>
                  {fullscreenCopied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  {fullscreenCopied ? 'Copied' : 'Copy Code'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setIsFullScreen(false)} title="Close (Esc)">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="fullscreen-modal-body p-4" style={{ flex: 1, overflow: 'auto', background: '#0e0f17' }}>
              <pre style={{ margin: 0, background: 'transparent' }}>
                <code ref={modalCodeRef} className={prismLangClass}>
                  {formattedCode || inputCode}
                </code>
              </pre>
            </div>
          </div>
        </div>
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

        .fullscreen-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .fullscreen-modal-content {
          width: 95vw;
          height: 90vh;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
          border: 1px solid var(--border-medium);
        }

        .fullscreen-modal-header {
          border-bottom: 1px solid var(--border-light);
          background: var(--bg-secondary);
        }

        @media (max-width: 900px) {
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
