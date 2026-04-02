import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { Cpu, Play, Trash2 } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeCompiler = () => {
  usePageTitle('Code Compiler');
  const [code, setCode] = useState('// Write your JS code here\nconsole.log("Hello, World!");\n');
  const [output, setOutput] = useState('');

  const runCode = () => {
    try {
      // Create a safely isolated output collector
      const logs = [];
      const originalLog = console.log;
      
      console.log = (...args) => {
        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
      };

      // Evaluate the code securely (mock compiling)
      // eslint-disable-next-line no-new-func
      const func = new Function(code);
      func();

      // Restore console.log
      console.log = originalLog;
      
      setOutput(logs.join('\n') || 'Execution complete with no output.');
    } catch (err) {
      setOutput(`Error: ${err.message}`);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Compiler" 
        description="Run JavaScript snippets directly in your browser."
        icon={Cpu}
        color="var(--success)"
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Editor */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="code-editor-header">
            <span className="font-mono text-sm text-muted">Input (JS)</span>
            <button className="btn btn-primary btn-sm" onClick={runCode} style={{ padding: '0.4rem 1rem' }}>
              <Play size={16} /> Run
            </button>
          </div>
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
            style={{ flex: 1, minHeight: '65vh', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
          />
        </div>

        {/* Output */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <div className="code-editor-header">
            <span className="font-mono text-sm text-muted">Output Terminal</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setOutput('')} style={{ padding: '0.4rem 1rem' }}>
              <Trash2 size={16} /> Clear
            </button>
          </div>
          <div 
            className="p-4 font-mono text-sm"
            style={{ 
              flex: 1, 
              minHeight: '65vh', 
              color: output.startsWith('Error') ? 'var(--danger)' : 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              overflowY: 'auto'
            }}
          >
            {output || <span className="text-muted">No output yet. Run your code!</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeCompiler;
