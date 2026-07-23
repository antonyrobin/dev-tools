import React, { useState } from 'react';
import ToolHeader from '../components/ToolHeader';
import { GitCompare, ArrowLeftRight, Trash2, CheckCircle, PlusCircle, MinusCircle, AlertCircle, Sparkles } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const sampleOriginal = `{
  "appName": "DevTools",
  "version": "1.0.0",
  "theme": "dark",
  "features": [
    "Format",
    "Minify",
    "Compile"
  ],
  "author": "DevTools Team"
}`;

const sampleModified = `{
  "appName": "DevTools Suite",
  "version": "1.2.0",
  "theme": "vibrant-dark",
  "features": [
    "Format",
    "Minify",
    "Compile",
    "Text Compare"
  ],
  "status": "active",
  "author": "DevTools Team"
}`;

// LCS Diff Algorithm
function computeDiff(origText, modText) {
  const origLines = origText.split('\n');
  const modLines = modText.split('\n');

  const M = origLines.length;
  const N = modLines.length;

  const dp = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = M, j = N;
  const rawOps = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      rawOps.push({ type: 'equal', orig: origLines[i - 1], mod: modLines[j - 1], origIndex: i - 1, modIndex: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.push({ type: 'add', mod: modLines[j - 1], modIndex: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawOps.push({ type: 'remove', orig: origLines[i - 1], origIndex: i - 1 });
      i--;
    }
  }
  rawOps.reverse();

  // Combine into side-by-side rows
  const rows = [];
  let k = 0;
  let additionsCount = 0;
  let deletionsCount = 0;
  let modificationsCount = 0;

  while (k < rawOps.length) {
    if (rawOps[k].type === 'equal') {
      rows.push({
        type: 'equal',
        left: { lineNum: rawOps[k].origIndex + 1, content: rawOps[k].orig },
        right: { lineNum: rawOps[k].modIndex + 1, content: rawOps[k].mod }
      });
      k++;
    } else {
      let removes = [];
      let adds = [];

      while (k < rawOps.length && rawOps[k].type === 'remove') {
        removes.push(rawOps[k]);
        k++;
      }
      while (k < rawOps.length && rawOps[k].type === 'add') {
        adds.push(rawOps[k]);
        k++;
      }

      if (removes.length > 0 && adds.length > 0) {
        const maxLen = Math.max(removes.length, adds.length);
        for (let m = 0; m < maxLen; m++) {
          const rem = removes[m];
          const add = adds[m];
          if (rem && add) {
            rows.push({
              type: 'modify',
              left: { lineNum: rem.origIndex + 1, content: rem.orig },
              right: { lineNum: add.modIndex + 1, content: add.mod }
            });
            modificationsCount++;
          } else if (rem) {
            rows.push({
              type: 'remove',
              left: { lineNum: rem.origIndex + 1, content: rem.orig },
              right: null
            });
            deletionsCount++;
          } else if (add) {
            rows.push({
              type: 'add',
              left: null,
              right: { lineNum: add.modIndex + 1, content: add.mod }
            });
            additionsCount++;
          }
        }
      } else if (removes.length > 0) {
        for (const rem of removes) {
          rows.push({
            type: 'remove',
            left: { lineNum: rem.origIndex + 1, content: rem.orig },
            right: null
          });
          deletionsCount++;
        }
      } else if (adds.length > 0) {
        for (const add of adds) {
          rows.push({
            type: 'add',
            left: null,
            right: { lineNum: add.modIndex + 1, content: add.mod }
          });
          additionsCount++;
        }
      }
    }
  }

  return { rows, additionsCount, deletionsCount, modificationsCount };
}

// Inline Word Diff for Modified lines
function computeInlineWordDiff(origStr, modStr) {
  const origTokens = origStr.split(/(\s+|[^\w\s]+)/).filter(Boolean);
  const modTokens = modStr.split(/(\s+|[^\w\s]+)/).filter(Boolean);

  const M = origTokens.length;
  const N = modTokens.length;
  const dp = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0));

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (origTokens[i - 1] === modTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = M, j = N;
  const leftResult = [];
  const rightResult = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origTokens[i - 1] === modTokens[j - 1]) {
      leftResult.push({ text: origTokens[i - 1], type: 'same' });
      rightResult.push({ text: modTokens[j - 1], type: 'same' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightResult.push({ text: modTokens[j - 1], type: 'add' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      leftResult.push({ text: origTokens[i - 1], type: 'remove' });
      i--;
    }
  }

  leftResult.reverse();
  rightResult.reverse();

  return { leftTokens: leftResult, rightTokens: rightResult };
}

const TextCompare = () => {
  usePageTitle('Text Comparison');
  const [originalText, setOriginalText] = useState(sampleOriginal);
  const [modifiedText, setModifiedText] = useState(sampleModified);
  const [diffResult, setDiffResult] = useState(computeDiff(sampleOriginal, sampleModified));

  const handleCompare = () => {
    const res = computeDiff(originalText, modifiedText);
    setDiffResult(res);
  };

  const handleSwap = () => {
    const temp = originalText;
    setOriginalText(modifiedText);
    setModifiedText(temp);
    setDiffResult(computeDiff(modifiedText, temp));
  };

  const handleClear = () => {
    setOriginalText('');
    setModifiedText('');
    setDiffResult({ rows: [], additionsCount: 0, deletionsCount: 0, modificationsCount: 0 });
  };

  const handleLoadSample = () => {
    setOriginalText(sampleOriginal);
    setModifiedText(sampleModified);
    setDiffResult(computeDiff(sampleOriginal, sampleModified));
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="Text Comparison" 
        description="Compare two texts side-by-side with color-coded indications for additions, deletions, and inline modifications."
        icon={GitCompare}
        color="var(--accent)"
      />

      {/* Control Buttons & Inputs */}
      <div className="glass-card p-6 mb-6" style={{ padding: '1.5rem' }}>
        <div className="flex justify-between items-center mb-4 block-mobile">
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleCompare}>
              <GitCompare size={18} /> Compare Texts
            </button>
            <button className="btn btn-outline" onClick={handleSwap} title="Swap Original and Modified">
              <ArrowLeftRight size={18} /> Swap
            </button>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={handleLoadSample}>
              <Sparkles size={16} /> Load Sample
            </button>
            <button className="btn btn-ghost" onClick={handleClear} style={{ color: 'var(--danger)' }}>
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>

        {/* Text Area Inputs */}
        <div className="grid grid-cols-2 gap-4 text-inputs-grid">
          <div className="form-group mb-0">
            <label className="form-label flex justify-between">
              <span>Original Text (Before)</span>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{originalText.split('\n').length} lines</span>
            </label>
            <textarea
              className="form-textarea code-textarea-input"
              placeholder="Paste original text here..."
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              rows={10}
            />
          </div>

          <div className="form-group mb-0">
            <label className="form-label flex justify-between">
              <span>Modified Text (After)</span>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{modifiedText.split('\n').length} lines</span>
            </label>
            <textarea
              className="form-textarea code-textarea-input"
              placeholder="Paste modified text here..."
              value={modifiedText}
              onChange={(e) => setModifiedText(e.target.value)}
              rows={10}
            />
          </div>
        </div>
      </div>

      {/* Diff Output Stats Header */}
      {diffResult.rows.length > 0 && (
        <div className="glass-card p-6" style={{ padding: '1.5rem' }}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h3 className="mb-0" style={{ fontSize: '1.25rem' }}>Comparison Result (Side-by-Side View)</h3>
            <div className="flex gap-3">
              <span className="diff-pill diff-pill-add">
                <PlusCircle size={14} /> {diffResult.additionsCount} Additions
              </span>
              <span className="diff-pill diff-pill-remove">
                <MinusCircle size={14} /> {diffResult.deletionsCount} Deletions
              </span>
              <span className="diff-pill diff-pill-modify">
                <AlertCircle size={14} /> {diffResult.modificationsCount} Modifications
              </span>
            </div>
          </div>

          {/* Side-by-side Split View Table */}
          <div className="diff-split-container">
            <div className="diff-split-header">
              <div className="diff-split-col-header">Original</div>
              <div className="diff-split-col-header">Modified</div>
            </div>

            <div className="diff-split-rows">
              {diffResult.rows.map((row, idx) => {
                let rowClass = 'diff-row-equal';
                if (row.type === 'add') rowClass = 'diff-row-add';
                if (row.type === 'remove') rowClass = 'diff-row-remove';
                if (row.type === 'modify') rowClass = 'diff-row-modify';

                // Inline word rendering for modified lines
                let leftTokens = null;
                let rightTokens = null;
                if (row.type === 'modify' && row.left && row.right) {
                  const inline = computeInlineWordDiff(row.left.content, row.right.content);
                  leftTokens = inline.leftTokens;
                  rightTokens = inline.rightTokens;
                }

                return (
                  <div key={idx} className={`diff-split-row ${rowClass}`}>
                    {/* Left Pane (Original) */}
                    <div className={`diff-pane left-pane ${row.type === 'remove' ? 'pane-removed' : row.type === 'modify' ? 'pane-modified' : ''}`}>
                      <span className="line-num">{row.left ? row.left.lineNum : ''}</span>
                      <span className="line-content">
                        {leftTokens ? (
                          leftTokens.map((tok, i) => (
                            <span key={i} className={tok.type === 'remove' ? 'inline-word-remove' : ''}>
                              {tok.text}
                            </span>
                          ))
                        ) : (
                          row.left ? row.left.content : ''
                        )}
                      </span>
                    </div>

                    {/* Right Pane (Modified) */}
                    <div className={`diff-pane right-pane ${row.type === 'add' ? 'pane-added' : row.type === 'modify' ? 'pane-modified' : ''}`}>
                      <span className="line-num">{row.right ? row.right.lineNum : ''}</span>
                      <span className="line-content">
                        {rightTokens ? (
                          rightTokens.map((tok, i) => (
                            <span key={i} className={tok.type === 'add' ? 'inline-word-add' : ''}>
                              {tok.text}
                            </span>
                          ))
                        ) : (
                          row.right ? row.right.content : ''
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .text-inputs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .code-textarea-input {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
        }

        .diff-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .diff-pill-add {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .diff-pill-remove {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .diff-pill-modify {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .diff-split-container {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-tertiary);
          font-family: var(--font-mono);
          font-size: 0.85rem;
        }

        .diff-split-header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid var(--border-light);
          font-weight: 700;
          color: var(--text-secondary);
        }

        .diff-split-col-header {
          padding: 0.6rem 1rem;
        }

        .diff-split-col-header:first-child {
          border-right: 1px solid var(--border-light);
        }

        .diff-split-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          line-height: 1.5;
        }

        .diff-pane {
          display: flex;
          padding: 0.25rem 0.5rem;
          white-space: pre-wrap;
          word-break: break-all;
          overflow-x: auto;
        }

        .left-pane {
          border-right: 1px solid var(--border-light);
        }

        .line-num {
          user-select: none;
          min-width: 35px;
          color: var(--text-muted);
          opacity: 0.6;
          text-align: right;
          padding-right: 0.75rem;
          font-size: 0.8rem;
        }

        .line-content {
          flex: 1;
        }

        /* Color indications */
        .pane-added {
          background: rgba(16, 185, 129, 0.12);
          border-left: 3px solid #10b981;
        }

        .pane-removed {
          background: rgba(239, 68, 68, 0.12);
          border-left: 3px solid #ef4444;
        }

        .pane-modified {
          background: rgba(245, 158, 11, 0.12);
          border-left: 3px solid #f59e0b;
        }

        .inline-word-remove {
          background: rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          text-decoration: line-through;
          padding: 0 2px;
          border-radius: 2px;
        }

        .inline-word-add {
          background: rgba(16, 185, 129, 0.35);
          color: #6ee7b7;
          font-weight: 700;
          padding: 0 2px;
          border-radius: 2px;
        }

        @media (max-width: 768px) {
          .text-inputs-grid {
            grid-template-columns: 1fr;
          }
          .diff-split-header, .diff-split-row {
            grid-template-columns: 1fr;
          }
          .left-pane {
            border-right: none;
            border-bottom: 1px solid var(--border-light);
          }
        }
      `}</style>
    </div>
  );
};

export default TextCompare;
