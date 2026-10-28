import React, { useState, useMemo } from 'react';
import { Pilcrow, RefreshCw } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import CopyButton from '../../components/CopyButton';
import { randomInt } from '../../utils/random';
import './Tools.css';

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure ' +
  'in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt ' +
  'culpa qui officia deserunt mollit anim id est laborum praesent elementum facilisis leo vel fringilla ultrices tincidunt ' +
  'arcu viverra mauris cursus mattis molestie pellentesque habitant morbi tristique senectus netus malesuada fames ac turpis ' +
  'egestas integer feugiat scelerisque varius quam nulla porttitor massa sapien faucibus vitae aliquet nec ullamcorper'
).split(' ');

const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

const range = (min, max) => min + randomInt(max - min + 1);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const makeWords = (n) => Array.from({ length: n }, () => WORDS[randomInt(WORDS.length)]);

function makeSentence() {
  const words = makeWords(range(6, 16));
  // Occasional comma for a more natural rhythm
  if (words.length > 8) words[range(3, words.length - 4)] += ',';
  return `${capitalize(words.join(' '))}.`;
}

const makeParagraph = () => Array.from({ length: range(4, 7) }, makeSentence).join(' ');

function generate(unit, count, startWithLorem) {
  let parts;
  if (unit === 'words') {
    const words = makeWords(count);
    if (startWithLorem) OPENING.replace(',', '').toLowerCase().split(' ').slice(0, count).forEach((w, i) => { words[i] = w; });
    return [capitalize(words.join(' ')) + '.'];
  }
  if (unit === 'sentences') parts = [Array.from({ length: count }, makeSentence).join(' ')];
  else parts = Array.from({ length: count }, makeParagraph);

  if (startWithLorem) {
    parts[0] = parts[0].replace(/^[^.]*\./, `${OPENING}.`);
  }
  return parts;
}

const UNITS = [
  { id: 'paragraphs', label: 'Paragraphs', max: 50 },
  { id: 'sentences', label: 'Sentences', max: 200 },
  { id: 'words', label: 'Words', max: 2000 },
];

const LoremIpsum = () => {
  const [unit, setUnit] = useState('paragraphs');
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [asHtml, setAsHtml] = useState(false);
  const [seed, setSeed] = useState(0);

  const max = UNITS.find((u) => u.id === unit).max;
  const parts = useMemo(() => {
    void seed;
    return generate(unit, Math.min(Math.max(1, count || 1), max), startWithLorem);
  }, [unit, count, max, startWithLorem, seed]);

  const text = asHtml ? parts.map((p) => `<p>${p}</p>`).join('\n') : parts.join('\n\n');
  const wordCount = parts.join(' ').split(/\s+/).filter(Boolean).length;

  return (
    <div className="tool-page">
      <ToolHeader
        title="Lorem Ipsum Generator"
        description="Placeholder text for layouts and mock-ups, as plain text or HTML paragraphs."
        icon={Pilcrow}
        color="#a3a3a3"
      />

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <div className="segmented" role="group" aria-label="Unit">
            {UNITS.map((u) => (
              <button key={u.id} type="button" className={unit === u.id ? 'active' : ''} onClick={() => setUnit(u.id)}>{u.label}</button>
            ))}
          </div>
          <input
            className="form-input"
            type="number"
            min={1}
            max={max}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Count"
            style={{ width: 90, padding: '0.45rem 0.7rem' }}
          />
          <label className="check-toggle"><input type="checkbox" checked={startWithLorem} onChange={(e) => setStartWithLorem(e.target.checked)} /><span>Start with “Lorem ipsum”</span></label>
          <label className="check-toggle"><input type="checkbox" checked={asHtml} onChange={(e) => setAsHtml(e.target.checked)} /><span>HTML &lt;p&gt;</span></label>
        </div>
        <button className="btn btn-primary" onClick={() => setSeed((n) => n + 1)}><RefreshCw size={16} /> Generate</button>
      </div>

      <div className="code-panel">
        <div className="code-panel-header">
          <span className="code-panel-title">Output</span>
          <CopyButton text={text} label="Copy" />
        </div>
        <div className="code-panel-body" style={{ height: 'auto', minHeight: 240 }}>
          <div className="output-block" style={{ border: 'none', borderRadius: 0, background: 'transparent', fontFamily: asHtml ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: asHtml ? undefined : '0.98rem', lineHeight: 1.7 }}>
            {text}
          </div>
        </div>
        <div className="code-panel-footer">
          <span>{wordCount.toLocaleString()} words</span>
          <span>{text.length.toLocaleString()} chars</span>
        </div>
      </div>
    </div>
  );
};

export default LoremIpsum;
