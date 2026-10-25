import React, { useState, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { MAX_MATCHES } from '../utils/textSearch';

/**
 * Find-in-content bar. The input updates instantly while the (expensive) query
 * propagation to the parent is debounced, so typing never blocks on large content.
 */
const FindBar = ({
  onQueryChange,
  total = 0,
  current = 0,
  onNext,
  onPrev,
  matchCase = false,
  onToggleMatchCase,
  useRegex = false,
  onToggleRegex,
  inputRef,
  placeholder = 'Find…',
  delay = 180,
}) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    const t = setTimeout(() => onQueryChange(value), value ? delay : 0);
    return () => clearTimeout(t);
  }, [value, delay, onQueryChange]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev?.();
      else onNext?.();
    } else if (e.key === 'Escape' && value) {
      // Clear first; a second Escape bubbles up (e.g. to exit full screen)
      e.preventDefault();
      e.stopPropagation();
      setValue('');
    }
  };

  const hasQuery = value.length > 0;
  const countLabel = !hasQuery
    ? ''
    : total === 0
      ? 'No results'
      : `${current + 1} of ${total >= MAX_MATCHES ? `${MAX_MATCHES}+` : total}`;

  return (
    <div className="find-bar" role="search">
      <Search size={14} className="find-icon" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Find text"
        spellCheck="false"
      />
      {hasQuery && (
        <span className={`find-count ${total === 0 ? 'no-results' : ''}`} aria-live="polite">{countLabel}</span>
      )}
      {onToggleMatchCase && (
        <button type="button" className={`find-btn ${matchCase ? 'active' : ''}`} onClick={onToggleMatchCase} title="Match case" aria-pressed={matchCase}>
          Aa
        </button>
      )}
      {onToggleRegex && (
        <button type="button" className={`find-btn ${useRegex ? 'active' : ''}`} onClick={onToggleRegex} title="Use regular expression" aria-pressed={useRegex}>
          .*
        </button>
      )}
      <button type="button" className="find-btn" onClick={onPrev} disabled={total === 0} title="Previous match (Shift+Enter)">
        <ChevronUp size={15} />
      </button>
      <button type="button" className="find-btn" onClick={onNext} disabled={total === 0} title="Next match (Enter)">
        <ChevronDown size={15} />
      </button>
      {hasQuery && (
        <button type="button" className="find-btn" onClick={() => setValue('')} title="Clear (Esc)">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default FindBar;
