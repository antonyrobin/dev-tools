import React, { useState, useRef, useMemo } from 'react';
import { Upload, AlertTriangle, FileText } from 'lucide-react';

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
  lineNumbers = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null);
  const gutterRef = useRef(null);

  // Gutter text is a single joined string: cheap even for tens of thousands of lines
  const lineCount = useMemo(() => {
    if (!lineNumbers || !value) return 1;
    let count = 1;
    for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) count++;
    return count;
  }, [value, lineNumbers]);

  const gutterText = useMemo(() => {
    if (!lineNumbers) return '';
    let out = '';
    for (let i = 1; i <= lineCount; i++) out += `${i}\n`;
    return out;
  }, [lineCount, lineNumbers]);

  const handleScroll = (e) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
  };

  const handleProcessFile = async (file) => {
    try {
      setFileError(null);
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

      {lineNumbers ? (
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

        .drag-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(19, 20, 28, 0.92);
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
