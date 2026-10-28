import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Regex, AlertTriangle, BookOpen, Replace } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import './Tools.css';
import './RegexTester.css';

const FLAGS = [
  { flag: 'g', title: 'Global — find all matches' },
  { flag: 'i', title: 'Ignore case' },
  { flag: 'm', title: 'Multiline — ^ and $ match at line breaks' },
  { flag: 's', title: 'Dot all — . matches newlines' },
  { flag: 'u', title: 'Unicode' },
  { flag: 'y', title: 'Sticky — match only at lastIndex' },
];

const CHEATSHEET = [
  ['.', 'Any character except newline'], ['\\d', 'Digit'], ['\\w', 'Word character'], ['\\s', 'Whitespace'],
  ['\\b', 'Word boundary'], ['^', 'Start of input / line'], ['$', 'End of input / line'], ['[abc]', 'Any of a, b, c'],
  ['[^abc]', 'Not a, b, c'], ['a|b', 'a or b'], ['(…)', 'Capture group'], ['(?<name>…)', 'Named group'],
  ['(?:…)', 'Non-capturing group'], ['(?=…)', 'Lookahead'], ['(?<=…)', 'Lookbehind'], ['*', '0 or more'],
  ['+', '1 or more'], ['?', '0 or 1 / lazy'], ['{2,5}', '2 to 5 times'], ['\\p{L}', 'Unicode letter (u flag)'],
];

const SAMPLE_PATTERN = '(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.]+)';
const SAMPLE_TEXT = `Contact ada@example.com or grace.hopper@navy.mil for access.
Invalid: someone@ and @nowhere.org
Support: help+devtools@company.co.uk`;

const TIMEOUT_MS = 1500;
const EMPTY_RESULT = { matches: [] };

/** Name (or null) of each capturing group, in order, read from the pattern source. */
function captureGroupNames(pattern) {
  const names = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') { i++; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; continue; }
    if (c !== '(') continue;
    if (pattern[i + 1] !== '?') names.push(null);
    else {
      const named = pattern.slice(i).match(/^\(\?<([A-Za-z_$][\w$]*)>/);
      if (named) names.push(named[1]);
    }
  }
  return names;
}

/** Runs matches in a worker; a pattern that takes too long is killed with the worker. */
function useRegexWorker() {
  const workerRef = useRef(null);
  const seq = useRef(0);
  useEffect(() => () => workerRef.current?.terminate(), []);

  return useCallback((payload) => new Promise((resolve) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../utils/regex.worker.js', import.meta.url), { type: 'module' });
    }
    const worker = workerRef.current;
    const id = ++seq.current;
    const timer = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      resolve({ id, error: `Matching took longer than ${TIMEOUT_MS / 1000}s and was stopped — the pattern may cause catastrophic backtracking.` });
    }, TIMEOUT_MS);
    const onMessage = (e) => {
      if (e.data.id !== id) return;
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      resolve(e.data);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ id, ...payload });
  }), []);
}

const RegexTester = () => {
  const [pattern, setPattern] = useState(SAMPLE_PATTERN);
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState(SAMPLE_TEXT);
  const [replacement, setReplacement] = useState('$<user> at $<domain>');
  const [showReplace, setShowReplace] = useState(false);
  const [showCheats, setShowCheats] = useState(false);
  const [rawResult, setResult] = useState(EMPTY_RESULT);
  // The highlighted match belongs to one result; a new result clears it
  const [active, setActive] = useState({ result: null, idx: -1 });
  const runMatch = useRegexWorker();
  const latest = useRef(0);
  const backdropRef = useRef(null);
  const textareaRef = useRef(null);

  const syntaxError = useMemo(() => {
    try {
      new RegExp(pattern, flags);
      return null;
    } catch (err) {
      return err.message;
    }
  }, [pattern, flags]);

  useEffect(() => {
    if (!pattern || syntaxError) return;
    const t = setTimeout(() => {
      const ticket = ++latest.current;
      runMatch({ pattern, flags, text, replacement, doReplace: showReplace }).then((res) => {
        if (ticket === latest.current) setResult(res.error ? { matches: [], error: res.error } : res);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [pattern, flags, text, replacement, showReplace, syntaxError, runMatch]);

  const result = !pattern || syntaxError ? EMPTY_RESULT : rawResult;
  const activeMatch = active.result === result ? active.idx : -1;

  const toggleFlag = (f) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, '') : FLAGS.map((x) => x.flag).filter((x) => cur.includes(x) || x === f).join('')));

  // Text split into plain and highlighted segments for the backdrop
  const segments = useMemo(() => {
    const out = [];
    let pos = 0;
    result.matches.forEach((m, i) => {
      if (m.index > pos) out.push(text.slice(pos, m.index));
      if (m.end === m.index) {
        out.push(<span key={i} className="rx-empty" data-idx={i} />);
      } else {
        out.push(<mark key={i} data-idx={i} className={`rx-mark rx-m${i % 2} ${i === activeMatch ? 'active' : ''}`}>{text.slice(m.index, m.end)}</mark>);
      }
      pos = Math.max(pos, m.end);
    });
    out.push(text.slice(pos));
    // Trailing newline keeps the backdrop the same height as the textarea
    out.push('\n');
    return out;
  }, [result.matches, text, activeMatch]);

  const syncScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const focusMatch = (i) => {
    setActive({ result, idx: i });
    const m = result.matches[i];
    const ta = textareaRef.current;
    if (!m || !ta) return;
    ta.focus();
    ta.setSelectionRange(m.index, m.end);
    // Scroll so the selection is visible, using the highlighted mark's position
    requestAnimationFrame(() => {
      const mark = backdropRef.current?.querySelector(`[data-idx="${i}"]`);
      if (mark) {
        ta.scrollTop = mark.offsetTop - ta.clientHeight / 3;
        syncScroll();
      }
    });
  };

  const groupCount = result.matches[0]?.groups.length || 0;
  const groupNames = useMemo(() => captureGroupNames(pattern), [pattern]);
  const error = syntaxError || result.error;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Regex Tester"
        description="Test JavaScript regular expressions with live match highlighting, capture groups and a replace preview."
        icon={Regex}
        color="#d946ef"
      >
        <ShareHistory
          toolId="regex"
          state={{ pattern, flags, text, replacement }}
          describe={(s) => `/${s.pattern}/${s.flags}`}
          isEmpty={(s) => !s.pattern}
          onRestore={(s) => {
            setPattern(s.pattern || '');
            setFlags(s.flags || '');
            setText(s.text || '');
            if (s.replacement !== undefined) setReplacement(s.replacement);
          }}
        />
      </ToolHeader>

      <div className="util-card mb-4">
        <div className="rx-pattern-row">
          <div className={`rx-pattern ${error ? 'has-error' : ''}`}>
            <span className="rx-slash">/</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="your pattern"
              spellCheck="false"
              aria-label="Regular expression"
              autoComplete="off"
            />
            <span className="rx-slash">/{flags}</span>
            <CopyButton text={`/${pattern}/${flags}`} title="Copy as literal" />
          </div>
          <div className="chip-row">
            {FLAGS.map(({ flag, title }) => (
              <button key={flag} type="button" className={`chip font-mono ${flags.includes(flag) ? 'active' : ''}`} onClick={() => toggleFlag(flag)} title={title} aria-pressed={flags.includes(flag)}>
                {flag}
              </button>
            ))}
            <button type="button" className={`chip ${showReplace ? 'active' : ''}`} onClick={() => setShowReplace((v) => !v)}>
              <Replace size={13} style={{ verticalAlign: '-2px' }} /> Replace
            </button>
            <button type="button" className={`chip ${showCheats ? 'active' : ''}`} onClick={() => setShowCheats((v) => !v)}>
              <BookOpen size={13} style={{ verticalAlign: '-2px' }} /> Cheatsheet
            </button>
          </div>
        </div>
        {error && <div className="inline-error mt-2"><AlertTriangle size={15} /> {error}</div>}
        {showCheats && (
          <div className="rx-cheats mt-3">
            {CHEATSHEET.map(([token, desc]) => (
              <button key={token} type="button" className="rx-cheat" onClick={() => setPattern((p) => p + token.replace('…', ''))} title="Append to pattern">
                <code>{token}</code><span>{desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="util-grid split-3-2">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Test string</span>
            <span className={`status-badge ${result.matches.length ? 'ok' : 'warn'}`}>
              {result.matches.length.toLocaleString()}{result.truncated ? '+' : ''} match{result.matches.length === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="code-panel-body">
            <div className="rx-editor">
              <div className="rx-backdrop" ref={backdropRef} aria-hidden="true">{segments}</div>
              <textarea
                ref={textareaRef}
                className="rx-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={syncScroll}
                spellCheck="false"
                placeholder="Text to test against…"
                aria-label="Test string"
              />
            </div>
          </div>
        </div>

        <div className="util-stack">
          {showReplace && (
            <div className="util-card">
              <div className="util-card-title">
                <span>Replace with</span>
                <CopyButton text={result.replaced || ''} title="Copy result" />
              </div>
              <input
                className="form-input mono-input"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="$1, $<name>, $&"
                spellCheck="false"
              />
              <pre className="output-block mt-2" style={{ maxHeight: 220 }}>{result.replaced ?? ''}</pre>
            </div>
          )}

          <div className="util-card">
            <div className="util-card-title">Matches</div>
            {result.matches.length === 0 ? (
              <div className="empty-hint">{pattern ? 'No matches.' : 'Enter a pattern.'}</div>
            ) : (
              <div className="table-scroll rx-matches">
                <table className="kv-table rx-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Match</th>
                      {Array.from({ length: groupCount }, (_, g) => (
                        <th key={g}>{groupNames[g] ? `${g + 1}: ${groupNames[g]}` : `Group ${g + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.slice(0, 500).map((m, i) => (
                      <tr key={i} className={i === activeMatch ? 'active' : ''} onClick={() => focusMatch(i)}>
                        <td className="text-muted">{i + 1}<div className="text-xs">@{m.index}</div></td>
                        <td>{m.text === '' ? <em className="text-muted">empty</em> : m.text}</td>
                        {m.groups.map((g, gi) => <td key={gi}>{g.value ?? <em className="text-muted">—</em>}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegexTester;
