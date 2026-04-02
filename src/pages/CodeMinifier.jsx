import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { Zap, Copy, Check } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeMinifier = () => {
  usePageTitle('Code Minifier');
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleMinify = () => {
    // Basic regex-based minifier for demonstration
    // Removes comments, newlines, and extra spaces
    try {
      let minified = inputCode
        // Remove single line comments
        .replace(/\/\/.*$/gm, '')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove newlines and tabs
        .replace(/[\n\r\t]/g, '')
        // Remove multiple spaces
        .replace(/\s{2,}/g, ' ')
        // Remove spaces around operators
        .replace(/\s*([=+\-*/<>{}()[\];,:.!])\s*/g, '$1');
        
      setOutputCode(minified);
    } catch (e) {
      setOutputCode('Error processing code.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Minifier" 
        description="Compress HTML, CSS, or JS by removing unnecessary whitespace."
        icon={Zap}
        color="var(--secondary)"
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-card flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Original Code</span>
            <button className="btn btn-secondary btn-sm" onClick={handleMinify} disabled={!inputCode} style={{ padding: '0.4rem 1rem' }}>
              Minify
            </button>
          </div>
          <textarea
            className="code-textarea"
            placeholder="Paste source code here..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            style={{ flex: 1, minHeight: '65vh' }}
          />
        </div>

        <div className="glass-card flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Minified Output</span>
            <button className="btn btn-outline btn-sm" onClick={handleCopy} disabled={!outputCode} style={{ padding: '0.4rem 1rem' }}>
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              Copy
            </button>
          </div>
          <textarea
            className="code-textarea text-success"
            readOnly
            value={outputCode}
            placeholder="Minified output will appear here..."
            style={{ flex: 1, minHeight: '65vh', background: 'var(--bg-primary)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeMinifier;
