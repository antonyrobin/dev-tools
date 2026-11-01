import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Download, Archive, Trash2, X, AlertTriangle, RefreshCw } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ImageDropzone from '../../components/ImageDropzone';
import {
  IMAGE_FORMATS, MAX_IMAGE_BYTES, encodableFormats, formatByMime, formatBytes, baseName,
  loadImage, fitWithin, renderImage, encodeCanvas, downloadBlob, downloadZip,
} from '../../utils/image';
import './Tools.css';
import './ImageTools.css';

const SAME = 'same';

// Formats "same as input" can keep; anything else (GIF, SVG, ICO, HEIC…) becomes PNG
const KEEPABLE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/bmp']);

const outputMime = (format, file) => {
  if (format !== SAME) return format;
  return KEEPABLE.has(file.type) && encodableFormats().some((f) => f.mime === file.type) ? file.type : 'image/png';
};

let nextId = 1;

/**
 * Batch image processor shared by the Image Compressor and Image Converter pages.
 * `mode` only changes the defaults and which controls are emphasised.
 */
const ImageBatch = ({ mode, title, description, icon, color }) => {
  const compress = mode === 'compress';
  const formats = useMemo(() => encodableFormats(), []);
  const [items, setItems] = useState([]);
  const [results, setResults] = useState({}); // id -> { blob, url, width, height, mime, keptOriginal, error }
  const [selectedId, setSelectedId] = useState(null);
  const [format, setFormat] = useState(compress ? SAME : 'image/webp');
  const [quality, setQuality] = useState(compress ? 70 : 90);
  const [maxW, setMaxW] = useState(compress ? 1920 : '');
  const [maxH, setMaxH] = useState(compress ? 1920 : '');
  const [background, setBackground] = useState('#ffffff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const decoded = useRef(new Map()); // id -> HTMLImageElement
  const urlsRef = useRef(new Set());

  const track = (url) => { urlsRef.current.add(url); return url; };
  const release = (url) => { if (url) { URL.revokeObjectURL(url); urlsRef.current.delete(url); } };

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = useCallback((files) => {
    const tooBig = files.filter((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} larger than 50 MB and was skipped.`);
    else setError(null);
    const added = files.filter((f) => f.size <= MAX_IMAGE_BYTES).map((file) => ({
      id: nextId++,
      file,
      name: file.name || `pasted-image.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`,
      thumb: track(URL.createObjectURL(file)),
    }));
    if (!added.length) return;
    setItems((prev) => [...prev, ...added]);
    setSelectedId((cur) => cur ?? added[0].id);
  }, []);

  const removeItem = (id) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) release(item.thumb);
      return prev.filter((i) => i.id !== id);
    });
    setResults((prev) => {
      const { [id]: gone, ...rest } = prev;
      release(gone?.url);
      return rest;
    });
    decoded.current.delete(id);
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const clearAll = () => {
    items.forEach((i) => release(i.thumb));
    Object.values(results).forEach((r) => release(r.url));
    decoded.current.clear();
    setItems([]);
    setResults({});
    setSelectedId(null);
  };

  // Re-encode everything whenever the files or settings change (debounced)
  useEffect(() => {
    if (!items.length) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      for (const item of items) {
        if (cancelled) break;
        try {
          let img = decoded.current.get(item.id);
          if (!img) {
            img = await loadImage(item.file);
            decoded.current.set(item.id, img);
          }
          const mime = outputMime(format, item.file);
          const fmt = formatByMime(mime);
          const { width, height } = fitWithin(img.sourceWidth, img.sourceHeight, Number(maxW) || 0, Number(maxH) || 0);
          const canvas = renderImage(img, { width, height, background: fmt.alpha ? undefined : background });
          let blob = await encodeCanvas(canvas, mime, quality / 100);
          // Compressing to the same format and size can't beat the original: keep it
          const keptOriginal = compress && mime === item.file.type && blob.size >= item.file.size
            && width === img.sourceWidth && height === img.sourceHeight;
          if (keptOriginal) blob = item.file;
          if (cancelled) break;
          const url = track(URL.createObjectURL(blob));
          setResults((prev) => {
            release(prev[item.id]?.url);
            return { ...prev, [item.id]: { blob, url, width, height, mime, keptOriginal } };
          });
        } catch (err) {
          if (cancelled) break;
          setResults((prev) => {
            release(prev[item.id]?.url);
            return { ...prev, [item.id]: { error: err.message || 'Could not process this image.' } };
          });
        }
      }
      if (!cancelled) setBusy(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [items, format, quality, maxW, maxH, background, compress]);

  const outputName = (item) => {
    const r = results[item.id];
    const ext = formatByMime(r?.mime)?.ext || 'png';
    return `${baseName(item.name)}${compress ? '-min' : ''}.${ext}`;
  };

  const done = items.filter((i) => results[i.id]?.blob);
  const totalIn = done.reduce((n, i) => n + i.file.size, 0);
  const totalOut = done.reduce((n, i) => n + results[i.id].blob.size, 0);
  const totalSaved = totalIn ? Math.round((1 - totalOut / totalIn) * 100) : 0;

  const selected = items.find((i) => i.id === selectedId) || items[0];
  const selRes = selected && results[selected.id];
  const selImg = selected && decoded.current.get(selected.id);
  const selFmt = formatByMime(outputMime(format, selected?.file || {}));
  const showQuality = format === SAME ? true : formatByMime(format)?.lossy;
  const needsBackground = format !== SAME && !formatByMime(format)?.alpha;

  const pct = (item) => {
    const r = results[item.id];
    if (!r?.blob) return null;
    return Math.round((1 - r.blob.size / item.file.size) * 100);
  };

  return (
    <div className="tool-page">
      <ToolHeader title={title} description={description} icon={icon} color={color} />

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="util-grid sidebar">
        <div className="util-stack">
          <div className="util-card">
            <div className="util-card-title">Output format</div>
            <div className="chip-row">
              {compress && (
                <button type="button" className={`chip ${format === SAME ? 'active' : ''}`} onClick={() => setFormat(SAME)}>Same as input</button>
              )}
              {formats.filter((f) => !compress || f.mime !== 'image/x-icon').map((f) => (
                <button type="button" key={f.mime} className={`chip ${format === f.mime ? 'active' : ''}`} onClick={() => setFormat(f.mime)}>{f.label}</button>
              ))}
            </div>
            {IMAGE_FORMATS.some((f) => !formats.includes(f)) && (
              <p className="text-xs text-muted mt-2">
                {IMAGE_FORMATS.filter((f) => !formats.includes(f)).map((f) => f.label).join(', ')} output isn’t supported by this browser.
              </p>
            )}
          </div>

          <div className="util-card">
            <div className="util-card-title">Settings</div>
            <div className="util-stack" style={{ gap: '0.9rem' }}>
              {showQuality && (
                <label className="field">
                  <span>Quality · {quality}%</span>
                  <input type="range" className="range-input" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                  <span className="text-xs text-muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                    Applies to JPEG, WebP and AVIF. 60–80% is usually indistinguishable from the original.
                  </span>
                </label>
              )}
              <div className="field-row">
                <label className="field">
                  <span>Max width</span>
                  <input className="form-input" type="number" min="1" placeholder="Any" value={maxW} onChange={(e) => setMaxW(e.target.value)} />
                </label>
                <label className="field">
                  <span>Max height</span>
                  <input className="form-input" type="number" min="1" placeholder="Any" value={maxH} onChange={(e) => setMaxH(e.target.value)} />
                </label>
              </div>
              <span className="text-xs text-muted">Larger images are scaled down to fit, keeping the aspect ratio. Leave empty to keep the size.</span>
              {needsBackground && (
                <label className="field">
                  <span>Background for transparent areas</span>
                  <div className="flex items-center gap-2">
                    <input type="color" className="color-input" value={background} onChange={(e) => setBackground(e.target.value)} />
                    <code className="text-sm">{background}</code>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="util-stack">
          <ImageDropzone multiple onFiles={addFiles} className={items.length ? 'compact' : ''} hint={items.length ? 'Add more images' : undefined} />

          {items.length > 0 && (
            <>
              <div className="img-summary">
                <span>
                  {items.length} image{items.length > 1 ? 's' : ''}
                  {done.length > 0 && <> · {formatBytes(totalIn)} → <strong>{formatBytes(totalOut)}</strong> {totalIn > 0 && <span className={`status-badge ${totalSaved >= 0 ? 'ok' : 'warn'}`}>{totalSaved >= 0 ? `−${totalSaved}%` : `+${-totalSaved}%`}</span>}</>}
                  {busy && <> · <RefreshCw size={12} className="animate-spin" style={{ display: 'inline' }} /> processing…</>}
                </span>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm btn-danger-ghost" onClick={clearAll}><Trash2 size={14} /> Clear</button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!done.length || busy}
                    onClick={() => (done.length === 1
                      ? downloadBlob(results[done[0].id].blob, outputName(done[0]))
                      : downloadZip(done.map((i) => ({ name: outputName(i), blob: results[i.id].blob })), compress ? 'compressed-images.zip' : 'converted-images.zip'))}
                  >
                    {done.length > 1 ? <Archive size={14} /> : <Download size={14} />} {done.length > 1 ? 'Download all (ZIP)' : 'Download'}
                  </button>
                </div>
              </div>

              {selected && (
                <div className="util-card">
                  <div className="img-compare">
                    <figure>
                      <figcaption><span>Original</span><span>{selImg ? `${selImg.sourceWidth}×${selImg.sourceHeight} · ` : ''}{formatBytes(selected.file.size)}</span></figcaption>
                      <div className="img-frame checker"><img src={selected.thumb} alt="Original" /></div>
                    </figure>
                    <figure>
                      <figcaption>
                        <span>{selFmt?.label || 'Output'}</span>
                        <span>{selRes?.blob ? `${selRes.width}×${selRes.height} · ${formatBytes(selRes.blob.size)}` : '…'}</span>
                      </figcaption>
                      <div className="img-frame checker">
                        {selRes?.url && <img src={selRes.url} alt="Result" />}
                        {selRes?.error && <span className="inline-error"><AlertTriangle size={14} /> {selRes.error}</span>}
                      </div>
                    </figure>
                  </div>
                </div>
              )}

              <div className="img-list">
                {items.map((item) => {
                  const r = results[item.id];
                  const p = pct(item);
                  return (
                    <div
                      key={item.id}
                      className={`img-row ${selected?.id === item.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(item.id); }}
                    >
                      <img className="img-thumb checker" src={item.thumb} alt="" />
                      <div className="img-row-main">
                        <div className="img-row-name" title={item.name}>{item.name}</div>
                        <div className="img-row-meta">
                          <span>{formatBytes(item.file.size)}</span>
                          {r?.blob && <span>→ {formatBytes(r.blob.size)} {formatByMime(r.mime)?.label}</span>}
                          {r?.blob && r.keptOriginal && <span className="status-badge info">already optimal</span>}
                          {r?.blob && !r.keptOriginal && p !== null && (
                            <span className={`status-badge ${p >= 0 ? 'ok' : 'warn'}`}>{p >= 0 ? `−${p}%` : `+${-p}%`}</span>
                          )}
                          {r?.error && <span className="status-badge bad" title={r.error}>failed</span>}
                          {!r && <span>processing…</span>}
                        </div>
                      </div>
                      <div className="img-row-actions">
                        <button
                          className="btn btn-ghost btn-xs"
                          disabled={!r?.blob}
                          title={`Download ${r?.blob ? outputName(item) : ''}`}
                          onClick={(e) => { e.stopPropagation(); downloadBlob(r.blob, outputName(item)); }}
                        >
                          <Download size={15} />
                        </button>
                        <button className="btn btn-ghost btn-xs btn-danger-ghost" title="Remove" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageBatch;
