import React, { useState, useMemo } from 'react';
import { Palette, Shuffle, AlertTriangle } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import usePageTitle from '../../hooks/usePageTitle';
import { parseColor, formatsOf, contrastRatio, toHex, mix } from '../../utils/color';
import { randomInt } from '../../utils/random';
import './Tools.css';
import './ColorConverter.css';

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const STEPS = [0.9, 0.75, 0.6, 0.45, 0.3, 0.15];

const ContrastCard = ({ fg, bg, label }) => {
  const ratio = contrastRatio(fg, bg);
  const pass = (min) => (ratio >= min ? 'ok' : 'bad');
  return (
    <div className="cc-contrast">
      <div className="cc-contrast-sample" style={{ background: toHex(bg), color: toHex(fg) }}>
        <span className="cc-sample-big">Aa</span>
        <span>{label}</span>
      </div>
      <div className="cc-contrast-info">
        <strong>{ratio.toFixed(2)} : 1</strong>
        <div className="chip-row">
          <span className={`status-badge ${pass(4.5)}`}>AA</span>
          <span className={`status-badge ${pass(7)}`}>AAA</span>
          <span className={`status-badge ${pass(3)}`}>AA large</span>
        </div>
      </div>
    </div>
  );
};

const Swatch = ({ color }) => {
  const hex = toHex(color);
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="cc-swatch"
      style={{ background: hex }}
      title={`Copy ${hex}`}
      onClick={() => {
        navigator.clipboard.writeText(hex).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        }).catch(() => {});
      }}
    >
      <span style={{ color: contrastRatio(color, WHITE) > contrastRatio(color, BLACK) ? '#fff' : '#000' }}>{copied ? 'Copied' : hex}</span>
    </button>
  );
};

const ColorConverter = () => {
  usePageTitle('Color Converter');
  const [input, setInput] = useState('#6366f1');

  const color = useMemo(() => parseColor(input), [input]);
  const formats = useMemo(() => (color ? formatsOf(color) : []), [color]);
  const opaque = color ? { ...color, a: 1 } : null;

  const tints = opaque ? STEPS.map((w) => mix(opaque, WHITE, w)) : [];
  const shades = opaque ? STEPS.slice().reverse().map((w) => mix(opaque, BLACK, w)) : [];

  const randomColor = () => setInput(toHex({ r: randomInt(256), g: randomInt(256), b: randomInt(256) }));

  return (
    <div className="tool-page">
      <ToolHeader
        title="Color Converter"
        description="Paste any CSS colour — hex, rgb(), hsl(), named colours, oklch() — and get every format, WCAG contrast and a tint/shade scale."
        icon={Palette}
        color="#ec4899"
      >
        <ShareHistory
          toolId="color"
          state={{ input }}
          isEmpty={(s) => !s.input.trim()}
          onRestore={(s) => setInput(s.input || '')}
        />
      </ToolHeader>

      <div className="util-grid sidebar">
        <div className="util-stack">
          <div className="util-card">
            <div className="cc-preview" style={{ '--cc': color ? (formats[2]?.[1] || '#000') : 'transparent' }}>
              {!color && <span className="text-muted text-sm">No colour</span>}
            </div>
            <div className="cc-input-row mt-3">
              <input
                type="color"
                className="cc-picker"
                value={color ? toHex(opaque) : '#000000'}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Pick a colour"
              />
              <input
                className="form-input mono-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="#ff8800, rgb(…), hsl(…), rebeccapurple"
                spellCheck="false"
                aria-label="Colour value"
              />
              <button className="btn btn-outline btn-sm" onClick={randomColor} title="Random colour"><Shuffle size={15} /></button>
            </div>
            {input.trim() && !color && <div className="inline-error mt-2"><AlertTriangle size={15} /> Not a colour this browser understands.</div>}
          </div>

          {opaque && (
            <div className="util-card">
              <div className="util-card-title">Contrast (WCAG 2)</div>
              <div className="util-stack" style={{ gap: '0.6rem' }}>
                <ContrastCard fg={WHITE} bg={opaque} label="White text" />
                <ContrastCard fg={BLACK} bg={opaque} label="Black text" />
              </div>
            </div>
          )}
        </div>

        <div className="util-stack">
          <div className="util-card">
            <div className="util-card-title">Formats</div>
            {color ? (
              <table className="kv-table stack-mobile">
                <tbody>
                  {formats.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                      <td className="kv-copy"><CopyButton text={value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-hint">Enter a colour to convert it.</div>}
          </div>

          {opaque && (
            <div className="util-card">
              <div className="util-card-title">Tints &amp; shades <span className="text-xs text-muted">click to copy</span></div>
              <div className="cc-scale">
                {tints.map((c, i) => <Swatch key={`t${i}`} color={c} />)}
                <Swatch color={opaque} />
                {shades.map((c, i) => <Swatch key={`s${i}`} color={c} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ColorConverter;
