import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { Code, Box } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeOptimizer = () => {
  usePageTitle('Code Optimizer');
  const [code, setCode] = useState('');
  const [optimized, setOptimized] = useState('');

  const optimizeCode = () => {
    let newCode = code;
    newCode = newCode.replace(/\bvar\b/g, 'const');
    newCode = newCode.replace(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*([a-zA-Z0-9_]+)\.length;\s*i\+\+\s*\)\s*\{([\s\S]*?)\}/g, 
                             '$1.forEach((item, i) => {$2})');
    newCode = newCode.replace(/console\.log\(\s*['"]?['"]?\s*\);?/g, '');
    
    setOptimized(newCode);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Optimizer" 
        description="Refactor and optimize your code for better performance and readability."
        icon={Code}
        color="var(--warning)"
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="code-editor-container flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Target Code</span>
            <div className="flex gap-2">
              <UploadButton 
                label="Upload"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}
                onFileLoaded={(res) => setCode(res.content)}
              />
              <button className="btn btn-primary btn-sm" onClick={optimizeCode} disabled={!code} style={{ padding: '0.4rem 1rem' }}>
                <Box size={15} className="mr-1" /> Optimize
              </button>
            </div>
          </div>
          <CodeDropzoneTextarea
            value={code}
            onChange={(val) => setCode(val)}
            placeholder="Paste or drag & drop code file needing optimization..."
            style={{ flex: 1, minHeight: '65vh' }}
          />
        </div>

        <div className="code-editor-container flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Optimized Code</span>
          </div>
          <textarea
            className="code-textarea text-warning"
            readOnly
            value={optimized}
            placeholder="Optimized code will appear here..."
            style={{ flex: 1, minHeight: '65vh', background: 'var(--bg-primary)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeOptimizer;
