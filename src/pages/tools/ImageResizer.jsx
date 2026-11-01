import React, { useState, useEffect, useMemo } from 'react';
import { Scaling, Download, Lock, Unlock, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, AlertTriangle, Undo2 } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ImageDropzone from '../../components/ImageDropzone';
import MaximizeButton from '../../components/MaximizeButton';
import useMaximize from '../../hooks/useMaximize';
import {
  MAX_IMAGE_BYTES, encodableFormats, formatByMime, formatBytes, baseName,
  loadImage, centerCrop, renderImage, encodeCanvas, downloadBlob,
} from '../../utils/image';
import './Tools.css';
import './ImageTools.css';

const ASPECTS = [
  { label: 'Original', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:5', value: 4 / 5 },
];

const PERCENTS = [25, 50, 75, 100, 150, 200];

const PRESETS = [
  { label: 'Full HD', w: 1920, h: 1080 },
  { label: 'HD', w: 1280, h: 720 },
  { label: 'Instagram', w: 1080, h: 1080 },
  { label: 'OG image', w: 1200, h: 630 },
  { label: 'Twitter header', w: 1500, h: 500 },
  { label: 'Thumbnail', w: 320, h: 180 },
];

const MAX_DIM = 16384;

const ImageResizer = () => {
  const formats = useMemo(() => encodableFormats().filter((f) => f.mime !== 'image/x-icon'), []);
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [error, setError] = useState(null);

  const [aspect, setAspect] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lock, setLock] = useState(true);
  const [format, setFormat] = useState('image/png');
  const [quality, setQuality] = useState(90);
  const [background, setBackground] = useState('#ffffff');

  const [result, setResult] = useState(null); // { blob, url, w, h }
  const [isMaximized, setIsMaximized] = useMaximize();

  const crop = useMemo(() => (img ? centerCrop(img.sourceWidth, img.sourceHeight, aspect) : null), [img, aspect]);

  // Changing the crop resets the target size to the cropped area (or to `size`)
  const selectAspect = (value, source = img, size) => {
    const c = centerCrop(source.sourceWidth, source.sourceHeight, value);
    setAspect(value);
    setWidth(String(size?.w ?? c.w));
    setHeight(String(size?.h ?? c.h));
  };

  const handleFiles = async ([f]) => {
    if (f.size > MAX_IMAGE_BYTES) { setError('Image is larger than 50 MB.'); return; }
    setError(null);
    try {
      const loaded = await loadImage(f);
      setFile(f);
      setImg(loaded);
      selectAspect(0, loaded);
      setRotate(0);
      setFlipH(false);
      setFlipV(false);
      const keep = formats.find((x) => x.mime === f.type);
      setFormat(keep ? keep.mime : 'image/png');
    } catch (err) {
      setError(err.message);
    }
  };

  const ratio = crop ? crop.w / crop.h : 1;
  const onWidth = (v) => {
    setWidth(v);
    if (lock && Number(v) > 0) setHeight(String(Math.max(1, Math.round(Number(v) / ratio))));
  };
  const onHeight = (v) => {
    setHeight(v);
    if (lock && Number(v) > 0) setWidth(String(Math.max(1, Math.round(Number(v) * ratio))));
  };
  const applyPercent = (p) => {
    if (!crop) return;
    setWidth(String(Math.max(1, Math.round((crop.w * p) / 100))));
    setHeight(String(Math.max(1, Math.round((crop.h * p) / 100))));
  };
  const applyPreset = (p) => selectAspect(p.w / p.h, img, p);

  const w = Math.min(MAX_DIM, Number(width) || 0);
  const h = Math.min(MAX_DIM, Number(height) || 0);
  const fmt = formatByMime(format);

  // Render the result (debounced so typing sizes stays smooth)
  useEffect(() => {
    if (!img || !w || !h) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const canvas = renderImage(img, { width: w, height: h, crop, rotate, flipH, flipV, background: fmt.alpha ? undefined : background });
        const blob = await encodeCanvas(canvas, format, quality / 100);
        if (cancelled) return;
        setResult((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height };
        });
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [img, w, h, crop, rotate, flipH, flipV, format, quality, background, fmt]);

  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const resetEdits = () => {
    selectAspect(0);
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="Image Resizer"
        description="Resize, crop to an aspect ratio, rotate and flip images, then save as PNG, JPEG, WebP or AVIF. Runs entirely in your browser."
        icon={Scaling}
        color="#f97316"
      />

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="util-grid sidebar">
        <div className="util-stack">
          <ImageDropzone onFiles={handleFiles} className={img ? 'compact' : ''} hint={img ? 'Replace image' : undefined} />

          <div className="util-card">
            <div className="util-card-title">Size</div>
            <div className="util-stack" style={{ gap: '0.75rem' }}>
              <div className="dim-inputs">
                <label className="field">
                  <span>Width</span>
                  <input className="form-input" type="number" min="1" max={MAX_DIM} value={width} onChange={(e) => onWidth(e.target.value)} disabled={!img} />
                </label>
                <button type="button" className={`btn btn-ghost btn-xs ${lock ? 'is-active' : ''}`} onClick={() => setLock((v) => !v)} title={lock ? 'Unlock aspect ratio' : 'Lock aspect ratio'} aria-pressed={lock}>
                  {lock ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
                <label className="field">
                  <span>Height</span>
                  <input className="form-input" type="number" min="1" max={MAX_DIM} value={height} onChange={(e) => onHeight(e.target.value)} disabled={!img} />
                </label>
              </div>
              <div className="chip-row">
                {PERCENTS.map((p) => <button type="button" key={p} className="chip" onClick={() => applyPercent(p)} disabled={!img}>{p}%</button>)}
              </div>
              <div className="chip-row">
                {PRESETS.map((p) => <button type="button" key={p.label} className="chip" onClick={() => applyPreset(p)} disabled={!img} title={`${p.w}×${p.h}`}>{p.label}</button>)}
              </div>
            </div>
          </div>

          <div className="util-card">
            <div className="util-card-title">
              Crop &amp; orientation
              <button type="button" className="btn btn-ghost btn-xs" onClick={resetEdits} disabled={!img}><Undo2 size={14} /> Reset</button>
            </div>
            <div className="util-stack" style={{ gap: '0.75rem' }}>
              <div className="chip-row">
                {ASPECTS.map((a) => (
                  <button type="button" key={a.label} className={`chip ${aspect === a.value ? 'active' : ''}`} onClick={() => selectAspect(a.value)} disabled={!img}>{a.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setRotate((r) => (r + 270) % 360)} disabled={!img} title="Rotate left"><RotateCcw size={15} /></button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setRotate((r) => (r + 90) % 360)} disabled={!img} title="Rotate right"><RotateCw size={15} /></button>
                <button type="button" className={`btn btn-outline btn-sm ${flipH ? 'is-active' : ''}`} onClick={() => setFlipH((v) => !v)} disabled={!img} title="Flip horizontally" aria-pressed={flipH}><FlipHorizontal2 size={15} /></button>
                <button type="button" className={`btn btn-outline btn-sm ${flipV ? 'is-active' : ''}`} onClick={() => setFlipV((v) => !v)} disabled={!img} title="Flip vertically" aria-pressed={flipV}><FlipVertical2 size={15} /></button>
              </div>
            </div>
          </div>

          <div className="util-card">
            <div className="util-card-title">Export</div>
            <div className="util-stack" style={{ gap: '0.75rem' }}>
              <div className="chip-row">
                {formats.map((f) => (
                  <button type="button" key={f.mime} className={`chip ${format === f.mime ? 'active' : ''}`} onClick={() => setFormat(f.mime)}>{f.label}</button>
                ))}
              </div>
              {fmt?.lossy && (
                <label className="field">
                  <span>Quality · {quality}%</span>
                  <input type="range" className="range-input" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                </label>
              )}
              {!fmt?.alpha && (
                <label className="field">
                  <span>Background</span>
                  <div className="flex items-center gap-2">
                    <input type="color" className="color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
                    <code className="text-sm">{background}</code>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className={`code-panel ${isMaximized ? 'is-maximized' : ''}`}>
          <div className="code-panel-header">
            <span className="code-panel-title">
              Result
              {result && <span className="badge-lang">{result.w}×{result.h}</span>}
            </span>
            <div className="code-panel-actions">
              {result && <span className="text-xs text-muted">{file && `${formatBytes(file.size)} → `}{formatBytes(result.blob.size)}</span>}
              <button
                className="btn btn-primary btn-sm"
                disabled={!result}
                onClick={() => downloadBlob(result.blob, `${baseName(file?.name)}-${result.w}x${result.h}.${fmt.ext}`)}
              >
                <Download size={14} /> Download
              </button>
              <MaximizeButton active={isMaximized} onToggle={() => setIsMaximized((v) => !v)} />
            </div>
          </div>
          <div className="code-panel-body" style={{ padding: '0.75rem', height: 'auto' }}>
            <div className="img-frame tall checker">
              {result ? <img src={result.url} alt="Resized result" /> : <span className="empty-hint">Add an image to start.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageResizer;
