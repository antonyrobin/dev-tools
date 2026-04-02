import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { Search, AlertCircle, CheckCircle } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const CodeReviewer = () => {
  usePageTitle('Code Reviewer');
  const [code, setCode] = useState('');
  const [issues, setIssues] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeCode = () => {
    setIsAnalyzing(true);
    // Simple mock heuristic code analysis
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
    }, 1500); // simulate delay
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Code Reviewer" 
        description="Automated heuristic code review to spot bugs and anti-patterns."
        icon={Search}
        color="var(--info)"
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '2rem' }}>
        <div className="glass-card flex flex-col">
          <div className="code-editor-header">
            <span className="font-mono text-sm">Source Code</span>
            <button className="btn btn-primary btn-sm" onClick={analyzeCode} disabled={!code || isAnalyzing} style={{ padding: '0.4rem 1rem' }}>
              {isAnalyzing ? 'Analyzing...' : 'Review Code'}
            </button>
          </div>
          <textarea
            className="code-textarea"
            placeholder="Paste code to review..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ flex: 1, minHeight: '65vh' }}
          />
        </div>

        <div className="glass-card flex flex-col" style={{ background: 'var(--bg-primary)' }}>
          <div className="code-editor-header">
            <span className="font-mono text-sm">Review Results</span>
          </div>
          <div className="p-4" style={{ flex: 1, overflowY: 'auto' }}>
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
                  }`} style={{ border: '1px solid', background: 'rgba(255,255,255,0.02)' }}>
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
