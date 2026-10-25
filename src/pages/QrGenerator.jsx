import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ToolHeader from '../components/ToolHeader';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const PRESETS = [
  { id: 'text', label: 'Text / URL' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
];

const LEVELS = [
  { value: 'L', label: 'Low (7%)' },
  { value: 'M', label: 'Medium (15%)' },
  { value: 'Q', label: 'Quartile (25%)' },
  { value: 'H', label: 'High (30%)' },
];

const escapeWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');

const QrGenerator = () => {
  usePageTitle('QR Generator');
  const [preset, setPreset] = useState('text');
  const [text, setText] = useState('https://devtools.redexoans.com');
  const [wifi, setWifi] = useState({ ssid: '', password: '', security: 'WPA', hidden: false });
  const [email, setEmail] = useState({ to: '', subject: '', body: '' });
  const [phone, setPhone] = useState('');
  const [size, setSize] = useState(512);
  const [level, setLevel] = useState('H');
  const [fgColor, setFgColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#0a0a0e');
  const [copied, setCopied] = useState(false);
  const svgWrapRef = useRef(null);

  const value = (() => {
    switch (preset) {
      case 'wifi':
        return wifi.ssid ? `WIFI:T:${wifi.security};S:${escapeWifi(wifi.ssid)};P:${escapeWifi(wifi.password)};${wifi.hidden ? 'H:true;' : ''};` : '';
      case 'email':
        return email.to ? `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}` : '';
      case 'phone':
        return phone ? `tel:${phone.replace(/\s+/g, '')}` : '';
      default:
        return text;
    }
  })();

  // Serialise the on-screen SVG at the requested export size with a solid background
  const getSvgMarkup = () => {
    const svg = svgWrapRef.current?.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', size);
    clone.setAttribute('height', size);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', bgColor);
    clone.insertBefore(bg, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  };

  const triggerDownload = (href, filename) => {
    const a = document.createElement('a');
    a.download = filename;
    a.href = href;
    a.click();
  };

  const downloadPng = () => {
    const markup = getSvgMarkup();
    if (!markup) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      triggerDownload(canvas.toDataURL('image/png'), 'qrcode.png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
  };

  const downloadSvg = () => {
    const markup = getSvgMarkup();
    if (!markup) return;
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    triggerDownload(url, 'qrcode.svg');
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    const markup = getSvgMarkup();
    if (!markup || !navigator.clipboard?.write) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard permission denied */ }
      });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="QR Code Generator"
        description="Generate QR codes for links, text, Wi-Fi, email or phone numbers and export as PNG or SVG."
        icon={QrCode}
        color="var(--info)"
      />

      <div className="qr-layout">
        <div className="glass-card qr-settings">
          <div className="segmented mb-4" role="tablist">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className={preset === p.id ? 'active' : ''} onClick={() => setPreset(p.id)}>{p.label}</button>
            ))}
          </div>

          {preset === 'text' && (
            <div className="form-group">
              <label className="form-label">Content (Text or URL)</label>
              <textarea className="form-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 80 }} />
            </div>
          )}

          {preset === 'wifi' && (
            <>
              <div className="form-group">
                <label className="form-label">Network name (SSID)</label>
                <input className="form-input" value={wifi.ssid} onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} />
              </div>
              <div className="qr-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" value={wifi.password} onChange={(e) => setWifi({ ...wifi, password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Security</label>
                  <select className="form-select" value={wifi.security} onChange={(e) => setWifi({ ...wifi, security: e.target.value })}>
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {preset === 'email' && (
            <>
              <div className="form-group">
                <label className="form-label">To</label>
                <input className="form-input" type="email" value={email.to} onChange={(e) => setEmail({ ...email, to: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Body</label>
                <textarea className="form-textarea" value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} style={{ minHeight: 80 }} />
              </div>
            </>
          )}

          {preset === 'phone' && (
            <div className="form-group">
              <label className="form-label">Phone number</label>
              <input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
          )}

          <div className="qr-row">
            <div className="form-group">
              <label className="form-label">Export size: {size}px</label>
              <input type="range" min="128" max="2048" step="64" value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Error correction</label>
              <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div className="qr-row">
            <div className="form-group">
              <label className="form-label">Foreground</label>
              <input type="color" className="form-input" value={fgColor} onChange={(e) => setFgColor(e.target.value)} style={{ padding: '0.2rem', height: 42 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Background</label>
              <input type="color" className="form-input" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ padding: '0.2rem', height: 42 }} />
            </div>
          </div>
        </div>

        <div className="glass-card qr-preview">
          <div ref={svgWrapRef} className="qr-canvas" style={{ background: bgColor }}>
            {value ? (
              <QRCodeSVG value={value} size={280} fgColor={fgColor} bgColor="transparent" level={level} style={{ width: '100%', height: 'auto' }} />
            ) : (
              <span className="text-muted text-sm">Fill in the fields to generate a code</span>
            )}
          </div>
          <div className="qr-actions">
            <button className="btn btn-primary" onClick={downloadPng} disabled={!value}>
              <Download size={16} /> PNG
            </button>
            <button className="btn btn-outline" onClick={downloadSvg} disabled={!value}>
              <Download size={16} /> SVG
            </button>
            <button className="btn btn-ghost" onClick={copyImage} disabled={!value} title="Copy image to clipboard">
              {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />} Copy
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .qr-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 1.25rem;
          max-width: 1200px;
        }
        .qr-settings { padding: 1.5rem; }
        .qr-settings .segmented { flex-wrap: wrap; }
        .qr-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .qr-settings input[type="range"] { accent-color: var(--primary); width: 100%; }
        .qr-preview {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
        }
        .qr-canvas {
          width: min(100%, 320px);
          aspect-ratio: 1;
          padding: 1rem;
          border-radius: var(--radius-lg);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .qr-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
        @media (max-width: 860px) {
          .qr-layout { grid-template-columns: 1fr; }
          .qr-preview { order: -1; }
        }
        @media (max-width: 480px) {
          .qr-row { grid-template-columns: 1fr; gap: 0; }
        }
      `}</style>
    </div>
  );
};

export default QrGenerator;
