import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import MaximizeButton from '../components/MaximizeButton';
import useMaximize from '../hooks/useMaximize';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';

const CodeReviewer = () => {
  const [code, setCode] = useState('');
  const [issues, setIssues] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maxPanel, setMaxPanel] = useMaximize();

  const togglePanel = (id) => setMaxPanel((v) => (v === id ? false : id));

  const analyzeCode = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const foundIssues = [];
      if (code.includes('var ')) {
        foundIssues.push({ type: 'warning', msg: 'Use let or const instead of var for variable declarations.' });
      }
      if (code.includes('==') && !code.includes('===')) {
        foundIssues.push({ type: 'warning', msg: 'Use strict equality (===) instead of loose equality (==).' });
      }
      if (code.includes('console.log')) {
        foundIssues.push({ type: 'info', msg: 'Console statements found. Ensure they are removed before production.' });
      }
      if (code.includes('eval(')) {
        foundIssues.push({ type: 'error', msg: 'eval() is used. This is a massive security risk.' });
      }
      if (!code.includes('try') && (code.includes('await') || code.includes('fetch'))) {
        foundIssues.push({ type: 'warning', msg: 'No try-catch blocks found around async operations.' });
      }

      if (foundIssues.length === 0 && code.trim().length > 0) {
        foundIssues.push({ type: 'success', msg: 'Code looks clean and follows basic best practices!' });
      }

      setIssues(foundIssues);
      setIsAnalyzing(false);
    }, 300);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="Code Reviewer"
        description="Automated heuristic code review to spot bugs and anti-patterns."
        icon={Search}
        color="var(--info)"
      />

      <div className="editor-split split-3-2">
        <div className={`code-panel ${maxPanel === 'input' ? 'is-maximized' : ''}`}>
          <div className="code-panel-header">
            <span className="code-panel-title">Source Code</span>
            <div className="code-panel-actions">
              <UploadButton
                label="Upload"
                className="btn btn-ghost btn-xs"
                onFileLoaded={(res) => setCode(res.content)}
              />
              <button className="btn btn-primary btn-sm" onClick={analyzeCode} disabled={!code || isAnalyzing} style={{ padding: '0.4rem 1rem' }}>
                {isAnalyzing ? 'Analyzing...' : 'Review Code'}
              </button>
              <MaximizeButton active={maxPanel === 'input'} onToggle={() => togglePanel('input')} />
            </div>
          </div>
          <div className="code-panel-body">
          <CodeDropzoneTextarea
            value={code}
            onChange={(val) => setCode(val)}
            placeholder="Paste or drag & drop code file to review..."
            lineNumbers
          />
          </div>
          <div className="code-panel-footer">
            <span>{code ? code.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{code.length.toLocaleString()} chars</span>
          </div>
        </div>

        <div className={`code-panel ${maxPanel === 'results' ? 'is-maximized' : ''}`}>
          <div className="code-panel-header">
            <span className="code-panel-title">
              Review Results {issues.length > 0 && <span className="badge-lang">{issues.length}</span>}
            </span>
            <div className="code-panel-actions">
              <MaximizeButton active={maxPanel === 'results'} onToggle={() => togglePanel('results')} />
            </div>
          </div>
          <div className="code-panel-body p-4" style={{ overflowY: 'auto' }}>
            {issues.length === 0 ? (
              <div className="text-center text-muted mt-8">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>Run a review to see suggestions.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {issues.map((issue, idx) => (
                  <div key={idx} className={`p-3 rounded flex gap-3 ${
                    issue.type === 'error' ? 'bg-danger-light text-danger border-danger' :
                    issue.type === 'warning' ? 'bg-warning-light text-warning border-warning' :
                    issue.type === 'success' ? 'bg-success-light text-success border-success' :
                    'bg-info-light text-info border-info'
                  }`} style={{ border: '1px solid', background: 'rgb(var(--fg-rgb) / 0.02)', flexShrink: 0 }}>
                    {issue.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="text-sm">{issue.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeReviewer;
