import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { Code, Box } from 'lucide-react';

const CodeOptimizer = () => {
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
    <div className="tool-page">
      <ToolHeader 
        title="Code Optimizer" 
        description="Refactor and optimize your code for better performance and readability."
        icon={Code}
        color="var(--warning)"
      />

      <div className="editor-split">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Target Code</span>
            <div className="flex gap-2">
              <UploadButton 
                label="Upload"
                className="btn btn-ghost btn-xs"
                onFileLoaded={(res) => setCode(res.content)}
              />
              <button className="btn btn-primary btn-sm" onClick={optimizeCode} disabled={!code} style={{ padding: '0.4rem 1rem' }}>
                <Box size={15} className="mr-1" /> Optimize
              </button>
            </div>
          </div>
          <div className="code-panel-body">
          <CodeDropzoneTextarea
            value={code}
            onChange={(val) => setCode(val)}
            placeholder="Paste or drag & drop code file needing optimization..."
            lineNumbers
          />
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Optimized Code</span>
          </div>
          <div className="code-panel-body">
            <textarea
              className="code-textarea text-warning"
              readOnly
              value={optimized}
              placeholder="Optimized code will appear here..."
              style={{ flex: 1, whiteSpace: 'pre', overflow: 'auto' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeOptimizer;
