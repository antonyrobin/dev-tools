import React, { useState, useRef } from 'react';
import {
  FileText, Upload, Download, RefreshCw, CheckCircle, AlertCircle, Info,
  FileSpreadsheet, FileCode, FileImage, Sparkles, File, Trash2, Zap, ArrowRight, PenLine
} from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import RichTextEditor from '../components/RichTextEditor';
import {
  parseFileToHtml,
  convertAndDownload,
  convertWordToPdfDirect,
  convertPdfToWordDirect
} from '../utils/fileConverter';
import './ConvertPage.css';

const SUPPORTED_FORMATS = [
  { id: 'docx', label: 'Word', ext: '.docx', icon: FileText, color: '#3b82f6' },
  { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileText, color: '#ef4444' },
  { id: 'xlsx', label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, color: '#10b981' },
  { id: 'csv', label: 'CSV', ext: '.csv', icon: FileSpreadsheet, color: '#059669' },
  { id: 'txt', label: 'Text', ext: '.txt', icon: FileText, color: '#9ca3af' },
  { id: 'md', label: 'Markdown', ext: '.md', icon: FileCode, color: '#8b5cf6' },
  { id: 'html', label: 'HTML', ext: '.html', icon: FileCode, color: '#f59e0b' },
  { id: 'json', label: 'JSON', ext: '.json', icon: FileCode, color: '#ec4899' },
  { id: 'png', label: 'PNG', ext: '.png', icon: FileImage, color: '#14b8a6' },
  { id: 'jpg', label: 'JPEG', ext: '.jpg', icon: FileImage, color: '#06b6d4' }
];

const SOURCE_TYPES = {
  docx: { label: 'Word document', icon: FileText, color: '#3b82f6' },
  doc: { label: 'Word document', icon: FileText, color: '#3b82f6' },
  pdf: { label: 'PDF document', icon: FileText, color: '#ef4444' },
  xlsx: { label: 'Excel workbook', icon: FileSpreadsheet, color: '#10b981' },
  xls: { label: 'Excel workbook', icon: FileSpreadsheet, color: '#10b981' },
  csv: { label: 'CSV file', icon: FileSpreadsheet, color: '#059669' },
  txt: { label: 'Plain text', icon: FileText, color: '#9ca3af' },
  md: { label: 'Markdown', icon: FileCode, color: '#8b5cf6' },
  html: { label: 'HTML page', icon: FileCode, color: '#f59e0b' },
  htm: { label: 'HTML page', icon: FileCode, color: '#f59e0b' },
  json: { label: 'JSON document', icon: FileCode, color: '#ec4899' },
  png: { label: 'PNG image', icon: FileImage, color: '#14b8a6' },
  jpg: { label: 'JPEG image', icon: FileImage, color: '#06b6d4' },
  jpeg: { label: 'JPEG image', icon: FileImage, color: '#06b6d4' },
  webp: { label: 'WebP image', icon: FileImage, color: '#06b6d4' },
  svg: { label: 'SVG image', icon: FileImage, color: '#06b6d4' },
};

const MODES = [
  { id: 'editor', label: 'Convert & edit', icon: Sparkles, accept: '.docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.html,.htm,.json,.png,.jpg,.jpeg,.webp,.svg', hint: 'Word, PDF, Excel, CSV, Text, Markdown, HTML, JSON or images' },
  { id: 'word-to-pdf', label: 'Word → PDF', icon: Zap, accept: '.docx,.doc', hint: 'Word (.docx) — converted to PDF and downloaded instantly', target: 'pdf' },
  { id: 'pdf-to-word', label: 'PDF → Word', icon: Zap, accept: '.pdf', hint: 'PDF (.pdf) — converted to Word and downloaded instantly', target: 'docx' },
];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const ConvertPage = () => {

  const [activeFile, setActiveFile] = useState(null);
  const [htmlContent, setHtmlContent] = useState('<h1>Welcome to File Converter!</h1><p>Upload a file on the left or start editing right here. You can format text, add tables, images, links, change colors, and convert your work to Word, PDF, Excel, Text, Markdown, HTML, JSON, or Image format.</p>');
  const [targetFormat, setTargetFormat] = useState('docx');
  const [outputFilename, setOutputFilename] = useState('converted_document');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [conversionMode, setConversionMode] = useState('editor');

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  const mode = MODES.find(m => m.id === conversionMode);
  const isInstantMode = conversionMode !== 'editor';
  const sourceExt = activeFile ? activeFile.ext : '';
  const sourceType = SOURCE_TYPES[sourceExt];

  const switchMode = (id) => {
    const next = MODES.find(m => m.id === id);
    setConversionMode(id);
    if (next.target) setTargetFormat(next.target);
    setStatusMessage(null);
  };

  // File Upload Processing
  const processUploadedFile = async (file) => {
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (conversionMode === 'word-to-pdf' && !['docx', 'doc'].includes(ext)) {
      setStatusMessage({ type: 'error', text: 'Word → PDF mode needs a .docx file. Switch to "Convert & edit" for other formats.' });
      return;
    }
    if (conversionMode === 'pdf-to-word' && ext !== 'pdf') {
      setStatusMessage({ type: 'error', text: 'PDF → Word mode needs a .pdf file. Switch to "Convert & edit" for other formats.' });
      return;
    }

    setIsParsing(true);
    setStatusMessage(null);

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setOutputFilename(`${baseName}_converted`);

    setActiveFile({
      name: file.name,
      size: formatBytes(file.size),
      ext,
      rawFile: file
    });

    try {
      // 1. Direct Word -> PDF Instant Conversion
      if (conversionMode === 'word-to-pdf') {
        setStatusMessage({ type: 'info', text: `Converting "${file.name}" to PDF…` });
        const parsedHtml = await parseFileToHtml(file);
        setHtmlContent(parsedHtml);
        await convertWordToPdfDirect(file, `${baseName}_converted`);
        setStatusMessage({ type: 'success', text: `Done! "${baseName}_converted.pdf" has been downloaded.` });
        return;
      }

      // 2. Direct PDF -> Word Instant Conversion
      if (conversionMode === 'pdf-to-word') {
        setStatusMessage({ type: 'info', text: `Converting "${file.name}" to Word…` });
        const parsedHtml = await parseFileToHtml(file);
        setHtmlContent(parsedHtml);
        await convertPdfToWordDirect(file, `${baseName}_converted`);
        setStatusMessage({ type: 'success', text: `Done! "${baseName}_converted.doc" has been downloaded.` });
        return;
      }

      // Standard editor mode: parse into the editor, pick a sensible different target
      const parsedHtml = await parseFileToHtml(file);
      setHtmlContent(parsedHtml);
      if (ext === targetFormat || (ext === 'doc' && targetFormat === 'docx')) {
        setTargetFormat(ext === 'pdf' ? 'docx' : 'pdf');
      }
      setStatusMessage({ type: 'success', text: `Loaded "${file.name}". Review it in the editor, choose a target format and convert.` });
    } catch (err) {
      console.error('Upload parse error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to process file' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const openFilePicker = () => fileInputRef.current && fileInputRef.current.click();

  // Convert and Export Download
  const handleConvert = async () => {
    setIsConverting(true);
    setStatusMessage(null);

    try {
      // Direct file conversion keeps original layout when the uploaded file is still active
      if (activeFile && activeFile.rawFile) {
        if (sourceExt === 'docx' && targetFormat === 'pdf') {
          await convertWordToPdfDirect(activeFile.rawFile, outputFilename);
          setStatusMessage({ type: 'success', text: `Word to PDF conversion complete! "${outputFilename}.pdf" downloaded.` });
          return;
        }
        if (sourceExt === 'pdf' && targetFormat === 'docx') {
          await convertPdfToWordDirect(activeFile.rawFile, outputFilename);
          setStatusMessage({ type: 'success', text: `PDF to Word conversion complete! "${outputFilename}.doc" downloaded.` });
          return;
        }
      }

      if (!htmlContent || !htmlContent.trim()) {
        setStatusMessage({ type: 'error', text: 'Editor is empty. Please add content before converting.' });
        return;
      }

      const currentHtml = editorRef.current ? editorRef.current.innerHTML : htmlContent;
      const editorCanvasEl = editorRef.current || document.querySelector('.rich-editor-canvas');

      await convertAndDownload(currentHtml, targetFormat, outputFilename, editorCanvasEl);

      const targetInfo = SUPPORTED_FORMATS.find(f => f.id === targetFormat);
      setStatusMessage({
        type: 'success',
        text: `Converted and downloaded "${outputFilename}${targetInfo ? targetInfo.ext : '.' + targetFormat}".`
      });
    } catch (err) {
      console.error('Conversion error:', err);
      setStatusMessage({ type: 'error', text: `Conversion failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    setActiveFile(null);
    setHtmlContent('<p></p>');
    setOutputFilename('converted_document');
    setStatusMessage(null);
  };

  const targetInfo = SUPPORTED_FORMATS.find(f => f.id === targetFormat) || SUPPORTED_FORMATS[0];
  const StatusIcon = statusMessage?.type === 'error' ? AlertCircle : statusMessage?.type === 'info' ? Info : CheckCircle;
  const SourceIcon = sourceType ? sourceType.icon : File;

  return (
    <div className="tool-page convert-page">
      <ToolHeader
        title="Document Converter"
        description="Convert Word, PDF, Excel, CSV, Text, Markdown, HTML, JSON and images — or edit the content before you export it."
        icon={FileText}
        color="var(--info)"
      >
        <div className="segmented mode-switcher" role="tablist" aria-label="Conversion mode">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={conversionMode === m.id}
              className={conversionMode === m.id ? 'active' : ''}
              onClick={() => switchMode(m.id)}
            >
              <m.icon size={14} /> {m.label}
            </button>
          ))}
        </div>
      </ToolHeader>

      {/* Source -> Target flow */}
      <div className="convert-flow">
        {/* 1. Source */}
        <section className="convert-card">
          <div className="convert-card-head">
            <span className="step-badge">1</span>
            <h2>Source</h2>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept={mode.accept}
          />

          {activeFile && !isParsing ? (
            <div className="source-file">
              <div className="source-file-icon" style={{ color: sourceType?.color, background: `${sourceType?.color || '#6366f1'}1f` }}>
                <SourceIcon size={26} />
              </div>
              <div className="source-file-info">
                <span className="source-file-name" title={activeFile.name}>{activeFile.name}</span>
                <span className="source-file-meta">{sourceType ? sourceType.label : sourceExt.toUpperCase()} · {activeFile.size}</span>
              </div>
              <div className="source-file-actions">
                <button type="button" className="btn btn-outline btn-xs" onClick={openFilePicker}>
                  <Upload size={13} /> Replace
                </button>
                <button type="button" className="btn btn-ghost btn-xs btn-danger-ghost" onClick={handleReset} title="Remove file">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`dropzone ${isDragging ? 'dragging' : ''} ${isParsing ? 'parsing' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={isParsing ? undefined : openFilePicker}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); } }}
            >
              {isParsing ? (
                <>
                  <RefreshCw size={28} className="animate-spin text-primary" />
                  <strong>Processing file…</strong>
                  <span className="text-xs text-muted">Parsing content{isInstantMode ? ' and generating the download' : ''}</span>
                </>
              ) : (
                <>
                  <div className="dropzone-icon"><Upload size={24} /></div>
                  <strong>Drop a file or <span className="text-gradient">browse</span></strong>
                  <span className="text-xs text-muted">{mode.hint}</span>
                </>
              )}
            </div>
          )}

          {!activeFile && !isInstantMode && (
            <p className="source-note">
              <PenLine size={13} /> No file? Type or paste content in the editor below and convert it.
            </p>
          )}
        </section>

        <div className="convert-arrow" aria-hidden="true">
          <ArrowRight size={20} />
        </div>

        {/* 2. Target */}
        <section className="convert-card">
          <div className="convert-card-head">
            <span className="step-badge">2</span>
            <h2>Target</h2>
          </div>

          <div className="format-grid" role="radiogroup" aria-label="Target format">
            {SUPPORTED_FORMATS.map(fmt => {
              const disabled = isInstantMode && fmt.id !== mode.target;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  role="radio"
                  aria-checked={targetFormat === fmt.id}
                  disabled={disabled}
                  className={`format-chip ${targetFormat === fmt.id ? 'active' : ''}`}
                  style={{ '--chip-color': fmt.color }}
                  onClick={() => setTargetFormat(fmt.id)}
                >
                  <fmt.icon size={15} />
                  <span>{fmt.label}</span>
                </button>
              );
            })}
          </div>

          {!isInstantMode && (
            <div className="target-row">
              <label className="filename-input" title="Output file name">
                <input
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="filename"
                  aria-label="Output file name"
                />
                <span className="extension-badge">{targetInfo.ext}</span>
              </label>
              <button
                type="button"
                className="btn btn-primary convert-cta"
                onClick={handleConvert}
                disabled={isConverting}
              >
                {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{isConverting ? 'Converting…' : 'Convert & Download'}</span>
              </button>
            </div>
          )}
          {isInstantMode && (
            <p className="source-note">
              <Zap size={13} /> Instant mode: the {targetInfo.label} file downloads automatically after upload.
            </p>
          )}
        </section>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className={`alert alert-${statusMessage.type}`} role="status">
          <StatusIcon size={16} />
          <span>{statusMessage.text}</span>
          <button className="alert-close" onClick={() => setStatusMessage(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* 3. Editor */}
      <section className="convert-editor">
        <div className="convert-card-head">
          <span className="step-badge">3</span>
          <h2>{isInstantMode ? 'Preview' : 'Preview & edit'}</h2>
          <span className="text-xs text-muted hide-mobile-text">Changes here are included when converting from the editor</span>
        </div>
        <RichTextEditor
          value={htmlContent}
          onChange={setHtmlContent}
          editorRef={editorRef}
        />
      </section>
    </div>
  );
};

export default ConvertPage;
