import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { Zap, Copy, Check } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeMinifier = () => {
  usePageTitle('Code Minifier');
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleMinify = () => {
    try {
      let minified = inputCode
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\n\r\t]/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*([=+\-*/<>{}()[\];,:.!])\s*/g, '$1');
        
      setOutputCode(minified);
    } catch {
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
        <div className="code-editor-container flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Original Code</span>
            <div className="flex gap-2">
              <UploadButton 
                label="Upload"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}
                onFileLoaded={(res) => setInputCode(res.content)}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleMinify} disabled={!inputCode} style={{ padding: '0.4rem 1rem' }}>
                Minify
              </button>
            </div>
          </div>
          <CodeDropzoneTextarea
            value={inputCode}
            onChange={(val) => setInputCode(val)}
            placeholder="Paste or drag & drop source code file..."
            style={{ flex: 1, minHeight: '65vh' }}
          />
        </div>

        <div className="code-editor-container flex flex-col">
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
