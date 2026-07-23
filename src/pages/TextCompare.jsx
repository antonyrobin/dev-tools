import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ToolHeader from '../components/ToolHeader';
import CodeDropzoneTextarea, { UploadButton } from '../components/CodeDropzoneTextarea';
import { GitCompare, ArrowLeftRight, Trash2, PlusCircle, MinusCircle, AlertCircle, Sparkles, Maximize2, X, Search, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Search states for full view
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const resultRef = useRef(null);
  const modalDiffContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Requirement: Scroll to Comparison Result section when Compare button is clicked
  const handleCompare = () => {
    const res = computeDiff(originalText, modifiedText);
    setDiffResult(res);
    setTimeout(() => {
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false);
    setSearchQuery('');
    setTotalMatches(0);
    setCurrentMatchIndex(0);
  }, []);

  // Lock body scroll on Full Screen
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  // Handle Search Highlighting in Full View Diff Table
  useEffect(() => {
    if (!isFullScreen || !modalDiffContainerRef.current) return;

    const container = modalDiffContainerRef.current;

    // Reset previous search marks
    const existingMarks = container.querySelectorAll('mark.search-match');
    existingMarks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    if (!searchQuery.trim()) {
      requestAnimationFrame(() => {
        setTotalMatches(0);
        setCurrentMatchIndex(0);
      });
      return;
    }

    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    const textNodes = [];
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentNode && node.parentNode.classList.contains('line-num')) continue;
      textNodes.push(node);
    }

    const createdMarks = [];

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      if (!text) return;

      let match;
      regex.lastIndex = 0;
      const matchesInNode = [];

      while ((match = regex.exec(text)) !== null) {
        matchesInNode.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        });
      }

      if (matchesInNode.length > 0) {
        const parent = textNode.parentNode;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;

        matchesInNode.forEach((m) => {
          if (m.index > lastIdx) {
            frag.appendChild(document.createTextNode(text.substring(lastIdx, m.index)));
          }

          const mark = document.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = m.text;
          frag.appendChild(mark);
          createdMarks.push(mark);

          lastIdx = m.index + m.length;
        });

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIdx)));
        }

        parent.replaceChild(frag, textNode);
      }
    });

    const count = createdMarks.length;

    requestAnimationFrame(() => {
      setTotalMatches(count);
      if (count > 0) {
        const validIndex = Math.min(Math.max(0, currentMatchIndex), count - 1);
        if (validIndex !== currentMatchIndex) {
          setCurrentMatchIndex(validIndex);
        }
        if (createdMarks[validIndex]) {
          createdMarks[validIndex].classList.add('search-match-active');
          createdMarks[validIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setCurrentMatchIndex(0);
      }
    });
  }, [searchQuery, currentMatchIndex, isFullScreen, diffResult]);

  const handleNextMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  };

  const handlePrevMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevMatch();
      } else {
        handleNextMatch();
      }
    } else if (e.key === 'Escape') {
      if (searchQuery) {
        e.stopPropagation();
        setSearchQuery('');
      } else {
        closeFullScreen();
      }
    }
  };

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen && !searchQuery) {
        closeFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, searchQuery, closeFullScreen]);

  // Shared Diff Table Component
  const renderDiffTable = (containerRef = null) => (
    <div className="diff-split-container" ref={containerRef}>
      <div className="diff-split-header">
        <div className="diff-split-col-header">Original Text</div>
        <div className="diff-split-col-header">Modified Text</div>
      </div>

      <div className="diff-split-rows">
        {diffResult.rows.map((row, idx) => {
          let rowClass = 'diff-row-equal';
          if (row.type === 'add') rowClass = 'diff-row-add';
          if (row.type === 'remove') rowClass = 'diff-row-remove';
          if (row.type === 'modify') rowClass = 'diff-row-modify';

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
  );

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
        {/* Requirement 2: Re-ordered Control Bar - Options on Left, Compare Texts button on Far Right */}
        <div className="flex justify-between items-center mb-4 block-mobile gap-3">
          <div className="flex gap-2 items-center flex-wrap">
            <button className="btn btn-ghost" onClick={handleLoadSample}>
              <Sparkles size={16} /> Sample
            </button>
            <button className="btn btn-outline" onClick={handleSwap} title="Swap Original and Modified">
              <ArrowLeftRight size={16} /> Swap
            </button>
            <UploadButton 
              label="Upload Original" 
              className="btn btn-outline btn-sm"
              onFileLoaded={(res) => setOriginalText(res.content)}
            />
            <UploadButton 
              label="Upload Modified" 
              className="btn btn-outline btn-sm"
              onFileLoaded={(res) => setModifiedText(res.content)}
            />
            <button className="btn btn-ghost" onClick={handleClear} style={{ color: 'var(--danger)' }}>
              <Trash2 size={16} /> Clear
            </button>
          </div>

          <div className="flex items-center">
            {/* Primary Action Button placed on Right Side */}
            <button className="btn btn-primary btn-lg" onClick={handleCompare}>
              <GitCompare size={18} /> Compare Texts
            </button>
          </div>
        </div>

        {/* Text Area Inputs */}
        <div className="grid grid-cols-2 gap-4 text-inputs-grid">
          <div className="form-group mb-0 flex flex-col">
            <label className="form-label flex justify-between mb-2">
              <span>Original Text (Before)</span>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{originalText.split('\n').length} lines</span>
            </label>
            <div className="code-editor-container flex-1">
              <CodeDropzoneTextarea
                value={originalText}
                onChange={(val) => setOriginalText(val)}
                placeholder="Paste or drag & drop original text file..."
                className="code-textarea-input"
                style={{ minHeight: '260px' }}
              />
            </div>
          </div>

          <div className="form-group mb-0 flex flex-col">
            <label className="form-label flex justify-between mb-2">
              <span>Modified Text (After)</span>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{modifiedText.split('\n').length} lines</span>
            </label>
            <div className="code-editor-container flex-1">
              <CodeDropzoneTextarea
                value={modifiedText}
                onChange={(val) => setModifiedText(val)}
                placeholder="Paste or drag & drop modified text file..."
                className="code-textarea-input"
                style={{ minHeight: '260px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Requirement 1: Comparison Result Section with auto-scroll focus */}
      {diffResult.rows.length > 0 && (
        <div className="glass-card p-6" style={{ padding: '1.5rem' }} ref={resultRef}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h3 className="mb-0" style={{ fontSize: '1.25rem' }}>Comparison Result (Side-by-Side View)</h3>
              {/* Requirement 3: Full Screen View Button for Comparison Result */}
              <button 
                className="btn btn-ghost btn-sm flex items-center gap-1"
                onClick={() => setIsFullScreen(true)}
                title="Full Screen Comparison View"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              >
                <Maximize2 size={15} />
                <span>Full Screen</span>
              </button>
            </div>

            <div className="flex gap-3 items-center">
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
          {renderDiffTable()}
        </div>
      )}

      {/* Requirement 3: Full Screen View Overlay for Comparison Result with Find Feature */}
      {isFullScreen && createPortal(
        <div className="fullscreen-overlay-page">
          <div className="fullscreen-header">
            {/* Title & Badges */}
            <div className="fullscreen-title-area">
              <GitCompare size={20} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '1rem', fontWeight: 700 }}>Comparison Result</span>
              <div className="flex gap-2 ml-2">
                <span className="diff-pill diff-pill-add" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                  +{diffResult.additionsCount}
                </span>
                <span className="diff-pill diff-pill-remove" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                  -{diffResult.deletionsCount}
                </span>
                <span className="diff-pill diff-pill-modify" style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                  ~{diffResult.modificationsCount}
                </span>
              </div>
            </div>

            {/* Find Text Search Bar */}
            <div className="fullscreen-search-bar">
              <div className="search-input-wrapper">
                <Search size={15} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input"
                  placeholder="Find text in diff (Enter / Shift+Enter)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Match Count Indicator */}
              <div className="search-count-badge">
                {totalMatches > 0 ? (
                  <span>{currentMatchIndex + 1}/{totalMatches}</span>
                ) : searchQuery ? (
                  <span className="text-muted">0/0</span>
                ) : (
                  <span className="text-muted">Find</span>
                )}
              </div>

              {/* Navigation Up & Down Arrows */}
              <div className="flex items-center gap-1">
                <button 
                  className="btn btn-ghost btn-xs search-nav-btn"
                  onClick={handlePrevMatch}
                  disabled={totalMatches === 0}
                  title="Previous match (Shift+Enter)"
                >
                  <ChevronUp size={15} />
                </button>
                <button 
                  className="btn btn-ghost btn-xs search-nav-btn"
                  onClick={handleNextMatch}
                  disabled={totalMatches === 0}
                  title="Next match (Enter)"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="fullscreen-actions">
              <button className="btn btn-ghost btn-sm close-modal-btn" onClick={closeFullScreen} title="Close Fullscreen (Esc)">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Full Screen Diff Body - SINGLE SCROLLBAR */}
          <div className="fullscreen-code-body p-6">
            {renderDiffTable(modalDiffContainerRef)}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .text-inputs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        /* Fix text color: Ensure bright white text in input textareas */
        .code-textarea-input {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          background: rgba(0, 0, 0, 0.3) !important;
          color: #f8fafc !important;
          border: none;
          padding: 1rem;
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
          color: #f8fafc;
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

        /* Full Screen Cover Styling */
        .fullscreen-overlay-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          max-width: 100%;
          max-height: 100%;
          background: #0a0a0f;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .fullscreen-header {
          flex-shrink: 0;
          background: #12131c;
          border-bottom: 1px solid var(--border-light);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          padding: 0.6rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }

        .fullscreen-title-area {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .fullscreen-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .fullscreen-code-body {
          flex: 1;
          overflow: auto;
          background: #090a0e;
        }

        .fullscreen-search-bar {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-medium);
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex: 1;
          max-width: 400px;
          box-sizing: border-box;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 80px;
        }

        .search-icon {
          position: absolute;
          left: 0.4rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          padding: 0.3rem 1.6rem 0.3rem 1.8rem;
          font-size: 0.85rem;
          width: 100%;
          outline: none;
          font-family: inherit;
        }

        .search-clear-btn {
          position: absolute;
          right: 0.3rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .search-clear-btn:hover {
          color: var(--text-primary);
        }

        .search-count-badge {
          font-size: 0.78rem;
          font-weight: 600;
          min-width: 45px;
          text-align: center;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .search-nav-btn {
          padding: 0.2rem;
          border-radius: var(--radius-sm);
        }

        mark.search-match {
          background-color: rgba(245, 158, 11, 0.45);
          color: #ffffff;
          border-radius: 2px;
          padding: 0 2px;
        }

        mark.search-match-active {
          background-color: #f59e0b !important;
          color: #000000 !important;
          font-weight: bold;
          outline: 2px solid #6366f1;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.9);
        }

        @media (max-width: 820px) {
          .fullscreen-header {
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "title actions"
              "search search";
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
          }

          .fullscreen-title-area {
            grid-area: title;
          }

          .fullscreen-actions {
            grid-area: actions;
          }

          .fullscreen-search-bar {
            grid-area: search;
            max-width: 100%;
            width: 100%;
          }

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
