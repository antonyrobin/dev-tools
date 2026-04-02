import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { FileJson, Play, Copy, Check } from 'lucide-react';
import * as prettier from 'prettier/standalone';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import prettierPluginPostcss from 'prettier/plugins/postcss';
import prettierPluginMarkdown from 'prettier/plugins/markdown';
import prettierPluginYaml from 'prettier/plugins/yaml';
import usePageTitle from '../hooks/usePageTitle';

const CodeFormatter = () => {
  usePageTitle('Code Formatter');
  const [inputCode, setInputCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const basicIndenter = (code) => {
    // A robust standard bracket-based indenter for C-like languages
    let indentLevel = 0;
    const lines = code.split('\n');
    const out = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      
      // Decrease indent if it starts with closing bracket
      if (line.match(/^[\}\]\)]/)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      out.push('  '.repeat(indentLevel) + line);
      
      // Calculate brackets for next lines
      const openCount = (line.match(/[\{\[\(]/g) || []).length;
      const closeCount = (line.match(/[\}\]\)]/g) || []).length;
      indentLevel += (openCount - closeCount);
      indentLevel = Math.max(0, indentLevel);
    }
    return out.join('\n');
  };

  const sqlFormatter = (code) => {
    // Basic SQL keywords capitalization and line splitting
    return code
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|LEFT JOIN|RIGHT JOIN|INNER JOIN|LIMIT|HAVING|INSERT|UPDATE|DELETE|SET|VALUES)\b/gi, '\n$1')
      .replace(/^\s*\n/gm, '')
      .trim();
  };

  const pythonFormatter = (code) => {
    // Normalizing spaces, removing multiple empty lines for Python
    return code
      .replace(/[ \t]+$/gm, '') // trim trailing spaces
      .replace(/\n{3,}/g, '\n\n') // max 2 blank lines
      .trim();
  };

  const handleFormat = async () => {
    try {
      setError(null);
      if (!inputCode.trim()) return;

      if (language === 'json') {
        const parsed = JSON.parse(inputCode);
        setInputCode(JSON.stringify(parsed, null, 2));
      } 
      else if (['java', 'c', 'cpp', 'csharp', 'php'].includes(language)) {
        setInputCode(basicIndenter(inputCode));
      }
      else if (language === 'sql') {
        setInputCode(sqlFormatter(inputCode));
      }
      else if (language === 'python') {
        setInputCode(pythonFormatter(inputCode));
      }
      else {
        // Prettier formatting map
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
          const formatted = await prettier.format(inputCode, {
            parser: parserMap[language] || 'babel',
            plugins: plugins,
            singleQuote: true,
            htmlWhitespaceSensitivity: 'ignore'
          });
          setInputCode(formatted);
        } catch (prettierErr) {
          console.warn("Prettier error, using basic formatter:", prettierErr);
          setError("Syntax error detected. Basic formatting applied.");
          setInputCode(basicIndenter(inputCode));
        }
      }
    } catch (err) {
      setError('Invalid code format. Please check for syntax errors.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languages = [
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'python', label: 'Python' },
    { value: 'sql', label: 'SQL' },
    { value: 'php', label: 'PHP' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YML / YAML' },
    { value: 'markdown', label: 'Markdown (MD)' },
  ];

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Formatter" 
        description="Clean and beautify your messy code across multiple languages instantly."
        icon={FileJson}
        color="var(--primary)"
      />

      <div className="glass-card p-6" style={{ padding: '1.5rem' }}>
        <div className="flex justify-between items-center mb-4 block-mobile">
          <div className="form-group mb-0" style={{ width: '220px' }}>
            <select 
              className="form-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <button className="btn btn-outline" onClick={handleCopy} disabled={!inputCode}>
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

        <div className="code-editor-container">
          <textarea
            className="code-textarea"
            placeholder="Paste your nasty code here..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            spellCheck="false"
            style={{ minHeight: '65vh' }}
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 600px) {
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
