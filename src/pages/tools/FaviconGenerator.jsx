import React, { useState, useEffect } from 'react';
import { AppWindow, Archive, Download, AlertTriangle } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ImageDropzone from '../../components/ImageDropzone';
import CopyButton from '../../components/CopyButton';
import { MAX_IMAGE_BYTES, formatBytes, loadImage, renderSquare, encodeIco, downloadBlob, downloadZip } from '../../utils/image';
import './Tools.css';
import './ImageTools.css';

// Apple touch icons get no transparency (iOS fills it with black)
const PNG_ICONS = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180, opaque: true },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

const toPng = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));

const FaviconGenerator = () => {
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);
  const [transparent, setTransparent] = useState(true);
  const [background, setBackground] = useState('#ffffff');
  const [padding, setPadding] = useState(0);
  const [radius, setRadius] = useState(0);
  const [appName, setAppName] = useState('My App');
  const [themeColor, setThemeColor] = useState('#6366f1');
  const [icons, setIcons] = useState([]); // { name, size, blob, url }

  const handleFiles = async ([file]) => {
    if (file.size > MAX_IMAGE_BYTES) { setError('Image is larger than 50 MB.'); return; }
    setError(null);
    try {
      setImg(await loadImage(file));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!img) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      const base = { background: transparent ? undefined : background, padding, radius };
      const pngs = await Promise.all(PNG_ICONS.map(async (icon) => ({
        ...icon,
        blob: await toPng(renderSquare(img, icon.size, icon.opaque && transparent ? { ...base, background: '#ffffff', radius: 0 } : base)),
      })));
      const ico = { name: 'favicon.ico', size: 48, blob: await encodeIco(img, [16, 32, 48], base) };
      if (cancelled) return;
      setIcons((prev) => {
        prev.forEach((i) => URL.revokeObjectURL(i.url));
        return [ico, ...pngs].map((i) => ({ ...i, url: URL.createObjectURL(i.blob) }));
      });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [img, transparent, background, padding, radius]);

  useEffect(() => () => icons.forEach((i) => URL.revokeObjectURL(i.url)), [icons]);

  const manifest = JSON.stringify({
    name: appName,
    short_name: appName,
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: themeColor,
    background_color: transparent ? '#ffffff' : background,
    display: 'standalone',
  }, null, 2);

  const html = [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join('\n');

  const downloadAll = () => downloadZip([
    ...icons.map((i) => ({ name: i.name, blob: i.blob })),
    { name: 'site.webmanifest', blob: new Blob([manifest], { type: 'application/manifest+json' }) },
    { name: 'favicon-snippet.html', blob: new Blob([html], { type: 'text/html' }) },
  ], 'favicons.zip');

  return (
    <div className="tool-page">
      <ToolHeader
        title="Favicon Generator"
        description="Create favicon.ico, PNG favicons, Apple touch and Android icons plus a web manifest and HTML tags from one image or logo."
        icon={AppWindow}
        color="#6366f1"
      />

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="util-grid sidebar">
        <div className="util-stack">
          <ImageDropzone onFiles={handleFiles} className={img ? 'compact' : ''} hint={img ? 'Replace image' : 'A square PNG or SVG of at least 512×512 works best'} />

          <div className="util-card">
            <div className="util-card-title">Appearance</div>
            <div className="util-stack" style={{ gap: '0.8rem' }}>
              <label className="check-toggle">
                <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                <span>Transparent background</span>
              </label>
              {!transparent && (
                <label className="field">
                  <span>Background</span>
                  <div className="flex items-center gap-2">
                    <input type="color" className="color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
                    <code className="text-sm">{background}</code>
                  </div>
                </label>
              )}
              <label className="field">
                <span>Padding · {padding}%</span>
                <input type="range" className="range-input" min="0" max="30" value={padding} onChange={(e) => setPadding(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Corner radius · {radius}%</span>
                <input type="range" className="range-input" min="0" max="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
              </label>
            </div>
          </div>

          <div className="util-card">
            <div className="util-card-title">Web manifest</div>
            <div className="util-stack" style={{ gap: '0.8rem' }}>
              <label className="field">
                <span>App name</span>
                <input className="form-input" value={appName} onChange={(e) => setAppName(e.target.value)} />
              </label>
              <label className="field">
                <span>Theme color</span>
                <div className="flex items-center gap-2">
                  <input type="color" className="color-input" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} />
                  <code className="text-sm">{themeColor}</code>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="util-stack">
          <div className="util-card">
            <div className="util-card-title">
              Icons
              <button className="btn btn-primary btn-sm" onClick={downloadAll} disabled={!icons.length}>
                <Archive size={14} /> Download all (ZIP)
              </button>
            </div>
            {icons.length ? (
              <div className="icon-grid">
                {icons.map((i) => (
                  <div className="icon-tile" key={i.name}>
                    <div className="icon-tile-preview checker">
                      <img src={i.url} alt={i.name} style={{ width: Math.min(i.size, 72), height: Math.min(i.size, 72) }} />
                    </div>
                    <span className="icon-tile-name">{i.name}</span>
                    <span className="text-xs text-muted">{i.name.endsWith('.ico') ? '16, 32, 48 px' : `${i.size}×${i.size}`} · {formatBytes(i.blob.size)}</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => downloadBlob(i.blob, i.name)}><Download size={13} /> Save</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-hint">Add an image to generate icons.</div>
            )}
          </div>

          <div className="util-card">
            <div className="util-card-title">
              HTML for your &lt;head&gt;
              <CopyButton text={html} label="Copy" />
            </div>
            <pre className="output-block">{html}</pre>
          </div>

          <div className="util-card">
            <div className="util-card-title">
              site.webmanifest
              <CopyButton text={manifest} label="Copy" />
            </div>
            <pre className="output-block">{manifest}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaviconGenerator;
