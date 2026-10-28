import React, { useState, useRef, useMemo } from 'react';
import { Upload, AlertTriangle, FileText, Pencil } from 'lucide-react';

const BINARY_EXTENSIONS = [
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'img',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'wav',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
];

const EXTENSION_LANG_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  java: 'java',
  cs: 'csharp',
  py: 'python',
  sql: 'sql',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown'
};

// Above this size a <textarea> takes seconds just to lay out, so large inputs get a light preview
const LARGE_INPUT_CHARS = 200000;
const PREVIEW_LINES = 300;

const formatSize = (chars) => (chars < 1048576 ? `${(chars / 1024).toFixed(0)} KB` : `${(chars / 1048576).toFixed(1)} MB`);

/** First `count` lines of text, found without splitting the whole string. */
const headLines = (text, count) => {
  let idx = -1;
  for (let i = 0; i < count; i++) {
    idx = text.indexOf('\n', idx + 1);
    if (idx === -1) return text;
  }
  return text.slice(0, idx);
};

/**
 * Validates and safely reads plain text/code content without script execution.
 */
function validateAndReadFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject('No file selected.');
    }

    const filename = file.name || '';
    const ext = filename.split('.').pop().toLowerCase();

    if (BINARY_EXTENSIONS.includes(ext)) {
      return reject(`Unsupported file type (.${ext}). Please upload a plain text or source code file.`);
    }

    if (file.size > 5 * 1024 * 1024) {
      return reject('File size exceeds maximum limit of 5MB.');
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result || '';

      const sample = content.slice(0, 2000);
      if (sample.includes('\0')) {
        return reject('Unsupported file content: Unreadable or binary file detected.');
      }

      resolve({
        content,
        filename,
        extension: ext,
        detectedLanguage: EXTENSION_LANG_MAP[ext] || null
      });
    };

    reader.onerror = () => {
      reject('Error reading file. Please check file permissions.');
    };

    reader.readAsText(file);
  });
}

/**
 * Standalone Upload Button for placement in top control bars.
 */
export const UploadButton = ({ 
  onFileLoaded, 
  onError, 
  label = "Upload File", 
  className = "btn btn-outline",
  style = {}
}) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const file = e.target.files[0];
        const res = await validateAndReadFile(file);
        if (onFileLoaded) onFileLoaded(res);
      } catch (err) {
        if (onError) onError(typeof err === 'string' ? err : 'Error uploading file.');
      }
      e.target.value = '';
    }
  };

  return (
    <>
      <button 
        type="button" 
        className={className} 
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        style={style}
        title="Upload code or text file"
      >
        <Upload size={16} />
        <span>{label}</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept=".json,.js,.jsx,.ts,.tsx,.html,.htm,.css,.java,.cs,.py,.sql,.php,.c,.cpp,.h,.hpp,.yml,.yaml,.md,.markdown,.txt,.xml,.log,.sh,.bat,text/*"
      />
    </>
  );
};

/**
 * Pure Dropzone Textarea (No inner header box, fills 100% textarea height).
 */
const CodeDropzoneTextarea = ({
  value,
  onChange,
  placeholder = 'Paste or drag & drop text file here...',
  className = 'code-textarea',
  style = {},
  readOnly = false,
  spellCheck = 'false',
  onFileLoaded = null,
  onError = null,
  lineNumbers = false,
  largeInputPreview = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [editLarge, setEditLarge] = useState(false);
  const gutterRef = useRef(null);

  const isLarge = largeInputPreview && value && value.length > LARGE_INPUT_CHARS;
  // Back to normal editing once the content is small again
  if (!isLarge && editLarge) setEditLarge(false);
  const showPreview = isLarge && !editLarge;

  const previewText = useMemo(() => (showPreview ? headLines(value, PREVIEW_LINES) : ''), [showPreview, value]);

  // Gutter text is a single joined string: cheap even for tens of thousands of lines
  const lineCount = useMemo(() => {
    if ((!lineNumbers && !showPreview) || !value) return 1;
    let count = 1;
    for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) count++;
    return count;
  }, [value, lineNumbers, showPreview]);

  const gutterText = useMemo(() => {
    if (!lineNumbers || showPreview) return '';
    let out = '';
    for (let i = 1; i <= lineCount; i++) out += `${i}\n`;
    return out;
  }, [lineCount, lineNumbers, showPreview]);

  const handleScroll = (e) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
  };

  // Large pastes skip the textarea entirely; inserting them there would freeze the page
  const handlePaste = (e) => {
    if (!largeInputPreview || !onChange || readOnly) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text || (editLarge && text.length <= LARGE_INPUT_CHARS)) return;
    const ta = e.currentTarget;
    const next = value.slice(0, ta.selectionStart) + text + value.slice(ta.selectionEnd);
    if (next.length <= LARGE_INPUT_CHARS) return;
    e.preventDefault();
    setEditLarge(false);
    onChange(next);
  };

  // Pasting onto the preview replaces the content
  const handlePreviewPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !onChange || readOnly) return;
    e.preventDefault();
    setEditLarge(false);
    onChange(text);
  };

  const handleProcessFile = async (file) => {
    try {
      setFileError(null);
      setEditLarge(false);
      const res = await validateAndReadFile(file);
      if (onChange) onChange(res.content);
      if (onFileLoaded) onFileLoaded(res);
    } catch (err) {
      const errMsg = typeof err === 'string' ? err : 'Unsupported file uploaded.';
      setFileError(errMsg);
      if (onError) onError(errMsg);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setIsDragging(true);
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
    if (readOnly) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`dropzone-textarea-wrapper ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {isDragging && (
        <div className="drag-overlay flex flex-col items-center justify-center">
          <FileText size={32} style={{ color: 'var(--primary)' }} className="mb-2" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Drop file here to load content</span>
        </div>
      )}

      {fileError && (
        <div className="p-2 text-xs flex items-center justify-between" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderBottom: '1px solid var(--danger)', zIndex: 6 }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{fileError}</span>
          </div>
          <button className="btn btn-ghost btn-xs p-0" style={{ lineHeight: 1 }} onClick={() => setFileError(null)}>×</button>
        </div>
      )}

      {showPreview ? (
        <div className="large-input-preview" tabIndex={0} onPaste={handlePreviewPaste} aria-label="Large input preview">
          <div className="large-input-banner">
            <FileText size={15} />
            <span>
              Large input · {formatSize(value.length)} · {lineCount.toLocaleString()} lines. Showing the first {PREVIEW_LINES} lines so the page stays fast; everything is still processed.
            </span>
            {!readOnly && (
              <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditLarge(true)} title="Load the full text into the editor (may be slow)">
                <Pencil size={13} /> Edit full text
              </button>
            )}
          </div>
          <pre className="large-input-pre">{previewText}{lineCount > PREVIEW_LINES ? `\n… ${(lineCount - PREVIEW_LINES).toLocaleString()} more lines` : ''}</pre>
        </div>
      ) : lineNumbers ? (
        <div className="numbered-editor">
          <div className="numbered-editor-gutter" ref={gutterRef} aria-hidden="true">
            {gutterText}
            <div style={{ height: '2rem' }} />
          </div>
          <textarea
            className={className}
            placeholder={placeholder}
            value={value}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            onScroll={handleScroll}
            onPaste={handlePaste}
            readOnly={readOnly}
            spellCheck={spellCheck}
            wrap="off"
            style={{ flex: 1, width: '100%', height: '100%', resize: 'none', outline: 'none', ...style }}
          />
        </div>
      ) : (
        <textarea
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onPaste={handlePaste}
          readOnly={readOnly}
          spellCheck={spellCheck}
          style={{ flex: 1, width: '100%', height: '100%', resize: 'none', outline: 'none', ...style }}
        />
      )}

      <style>{`
        .dropzone-textarea-wrapper {
          position: relative;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }

        .dropzone-textarea-wrapper.dragging {
          border: 2px dashed var(--primary) !important;
          background: rgba(99, 102, 241, 0.08) !important;
        }

        .large-input-preview {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-code);
          outline: none;
        }

        .large-input-preview:focus-visible {
          box-shadow: inset 0 0 0 2px var(--primary);
        }

        .large-input-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          padding: 0.5rem 0.75rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          background: var(--primary-soft);
          border-bottom: 1px solid var(--border-light);
        }

        .large-input-banner span {
          flex: 1;
          min-width: 12rem;
        }

        .large-input-pre {
          flex: 1;
          min-height: 0;
          margin: 0;
          padding: 0.75rem;
          overflow: auto;
          font-family: var(--font-mono);
          font-size: var(--code-font-size);
          line-height: var(--code-line-height);
          color: var(--text-primary);
          white-space: pre;
          tab-size: 2;
        }

        .drag-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--overlay-bg);
          backdrop-filter: blur(4px);
          z-index: 10;
          pointer-events: none;
          color: var(--text-primary);
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
};

export default CodeDropzoneTextarea;
