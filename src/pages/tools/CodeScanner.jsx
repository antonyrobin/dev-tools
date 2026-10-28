import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScanLine, ImageUp, Camera, CameraOff, Trash2, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import CopyButton from '../../components/CopyButton';
import { scanImage, scanFrame, describeContent, preloadScanner } from '../../utils/codeScanner';
import './Tools.css';
import './CodeScanner.css';

const FRAME_INTERVAL = 200;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const ResultCard = ({ result }) => {
  const info = describeContent(result.text);
  return (
    <div className="scan-result">
      <div className="scan-result-head">
        <span className="chip active">{result.format}</span>
        <span className="chip">{info.type}</span>
        <span className="scan-result-meta">{result.source === 'camera' ? 'Camera' : result.fileName || 'Image'}</span>
        <div className="code-panel-actions">
          {info.href && (
            <a className="btn btn-ghost btn-xs" href={info.href} target="_blank" rel="noopener noreferrer" title={`Open ${info.href}`}>
              <ExternalLink size={14} /><span>Open</span>
            </a>
          )}
          <CopyButton text={result.text} label="Copy" />
        </div>
      </div>
      <pre className="scan-result-text">{result.text}</pre>
      {info.details?.length > 0 && (
        <table className="kv-table">
          <tbody>
            {info.details.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td><code>{v}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const CodeScanner = () => {
  const [mode, setMode] = useState('image');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // object URL of the last image
  const [dragging, setDragging] = useState(false);
  const [lastScan, setLastScan] = useState(null); // { count } for the last image

  // Camera
  const [cameraOn, setCameraOn] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [stopOnFirst, setStopOnFirst] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const loopRef = useRef(null);
  const stopOnFirstRef = useRef(stopOnFirst);
  stopOnFirstRef.current = stopOnFirst;

  // Mirrors `results` so the camera loop can tell synchronously whether a code is new
  const resultsRef = useRef(results);
  resultsRef.current = results;

  /** Adds codes not seen yet; returns how many were new. */
  const addResults = useCallback((found, extra) => {
    const prev = resultsRef.current;
    const fresh = found.filter((f) => !prev.some((p) => p.text === f.text && p.format === f.format));
    if (!fresh.length) return 0;
    const next = [...fresh.map((f, i) => ({ ...f, ...extra, id: `${Date.now()}-${i}-${Math.random()}` })), ...prev];
    resultsRef.current = next;
    setResults(next);
    return fresh.length;
  }, []);

  // ----- Images -----

  const handleImage = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image. Use PNG, JPG, WebP, GIF, BMP or SVG.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image is larger than 25 MB.');
      return;
    }
    setError(null);
    setBusy(true);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    try {
      const found = await scanImage(file);
      setLastScan({ count: found.length });
      addResults(found, { source: 'image', fileName: file.name || 'Pasted image' });
    } catch (err) {
      setError(`Could not read that image: ${err.message || 'unsupported format'}`);
    } finally {
      setBusy(false);
    }
  }, [addResults]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Ctrl/Cmd+V anywhere on the page scans a copied image
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      setMode('image');
      handleImage(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleImage]);

  // ----- Camera -----

  const stopCamera = useCallback(() => {
    clearTimeout(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async (id = deviceId) => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs a secure (HTTPS) page and a browser that supports it.');
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      // Labels are only available once permission is granted
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'videoinput'));
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId || id || '');
      preloadScanner();

      const tick = async () => {
        if (!streamRef.current) return;
        if (video.readyState >= 2) {
          try {
            const found = await scanFrame(video, canvasRef.current || (canvasRef.current = document.createElement('canvas')));
            if (found.length && addResults(found, { source: 'camera' }) > 0) {
              navigator.vibrate?.(60);
              if (stopOnFirstRef.current) { stopCamera(); return; }
            }
          } catch { /* skip this frame */ }
        }
        if (streamRef.current) loopRef.current = setTimeout(tick, FRAME_INTERVAL);
      };
      tick();
    } catch (err) {
      stopCamera();
      setError(err.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access for this site and try again.'
        : err.name === 'NotFoundError'
          ? 'No camera was found on this device.'
          : `Could not start the camera: ${err.message || err.name}`);
    }
  }, [deviceId, stopCamera, addResults]);

  useEffect(() => stopCamera, [stopCamera]);

  const switchMode = (next) => {
    if (next === mode) return;
    if (next !== 'camera') stopCamera();
    setError(null);
    setMode(next);
  };

  return (
    <div className="tool-page">
      <ToolHeader
        title="QR & Barcode Scanner"
        description="Read QR codes and barcodes (EAN, UPC, Code 128, Data Matrix, PDF417 and more) from images or your camera. Everything is decoded locally in your browser."
        icon={ScanLine}
        color="#0ea5e9"
      />

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button className="alert-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="util-grid">
        <div className="code-panel">
          <div className="code-panel-header">
            <div className="segmented" role="group" aria-label="Source">
              <button type="button" className={mode === 'image' ? 'active' : ''} onClick={() => switchMode('image')}>
                <ImageUp size={14} /> Image
              </button>
              <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => switchMode('camera')}>
                <Camera size={14} /> Camera
              </button>
            </div>
            {mode === 'image' && (
              <label className="btn btn-outline btn-xs">
                <ImageUp size={14} /><span>Choose image</span>
                <input type="file" hidden accept="image/*" onChange={(e) => { handleImage(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
          </div>

          <div className="code-panel-body scan-body">
            {mode === 'image' ? (
              <label
                className={`scan-drop ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleImage(e.dataTransfer.files?.[0]); }}
              >
                <input type="file" hidden accept="image/*" onChange={(e) => { handleImage(e.target.files?.[0]); e.target.value = ''; }} />
                {preview ? (
                  <img src={preview} alt="Scanned" className="scan-preview" />
                ) : (
                  <span className="scan-drop-hint">
                    <ImageUp size={30} />
                    <strong>Drop, choose or paste an image</strong>
                    <span className="text-sm text-muted">Screenshots and photos work; press Ctrl+V to paste</span>
                  </span>
                )}
                {busy && <span className="scan-status"><RefreshCw size={14} className="animate-spin" /> Scanning…</span>}
                {!busy && lastScan && (
                  <span className={`scan-status ${lastScan.count ? 'ok' : 'none'}`}>
                    {lastScan.count ? `Found ${lastScan.count} code${lastScan.count > 1 ? 's' : ''}` : 'No code found. Try a sharper or closer image.'}
                  </span>
                )}
              </label>
            ) : (
              <div className="scan-camera">
                <video ref={videoRef} className={`scan-video ${cameraOn ? 'on' : ''}`} muted playsInline />
                {cameraOn ? (
                  <span className="scan-reticle" aria-hidden="true" />
                ) : (
                  <div className="scan-camera-idle">
                    <Camera size={30} />
                    <span className="text-sm text-muted">Point your camera at a QR code or barcode</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {mode === 'camera' && (
            <div className="code-panel-footer scan-camera-controls">
              {cameraOn ? (
                <button className="btn btn-outline btn-sm" onClick={stopCamera}><CameraOff size={15} /> Stop</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => startCamera()}><Camera size={15} /> Start camera</button>
              )}
              {devices.length > 1 && (
                <select
                  className="form-select"
                  value={deviceId}
                  onChange={(e) => { setDeviceId(e.target.value); if (cameraOn) startCamera(e.target.value); }}
                  aria-label="Camera"
                >
                  {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                </select>
              )}
              <label className="check-toggle">
                <input type="checkbox" checked={stopOnFirst} onChange={(e) => setStopOnFirst(e.target.checked)} />
                <span>Stop after a scan</span>
              </label>
            </div>
          )}
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Results {results.length > 0 && <span className="badge-lang">{results.length}</span>}</span>
            <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setResults([])} disabled={!results.length}>
              <Trash2 size={14} /><span>Clear</span>
            </button>
          </div>
          <div className="code-panel-body scan-results">
            {results.length ? (
              results.map((r) => <ResultCard key={r.id} result={r} />)
            ) : (
              <div className="empty-hint">Decoded codes will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeScanner;
