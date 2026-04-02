import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { Code, Box } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeOptimizer = () => {
  usePageTitle('Code Optimizer');
  const [code, setCode] = useState('');
  const [optimized, setOptimized] = useState('');

  const optimizeCode = () => {
    // Advanced dummy string replacements to simulate "optimizations"
    // e.g. switching double loops (dummy), fixing var to const (dummy)
    let newCode = code;
    
    // Replace var with const
    newCode = newCode.replace(/\bvar\b/g, 'const');
    
    // Convert basic loops to modern methods where possible (mock representation)
    newCode = newCode.replace(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*([a-zA-Z0-9_]+)\.length;\s*i\+\+\s*\)\s*\{([\s\S]*?)\}/g, 
                             '$1.forEach((item, i) => {$2})');
                             
    // Remove empty console.logs
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
        <div className="glass-card flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Target Code</span>
            <button className="btn btn-primary btn-sm" onClick={optimizeCode} disabled={!code} style={{ padding: '0.4rem 1rem' }}>
              <Box size={16} className="mr-1" /> Optimize
            </button>
          </div>
          <textarea
            className="code-textarea"
            placeholder="Paste code needing optimization..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ flex: 1, minHeight: '65vh' }}
          />
        </div>

        <div className="glass-card flex flex-col">
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
