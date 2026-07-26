import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Download, RefreshCw, CheckCircle, AlertCircle, 
  FileSpreadsheet, FileCode, FileImage, Sparkles, File, Trash2, ChevronDown, Zap, ArrowRight
} from 'lucide-react';
import ToolHeader from '../components/ToolHeader';
import RichTextEditor from '../components/RichTextEditor';
import usePageTitle from '../hooks/usePageTitle';
import { 
  parseFileToHtml, 
  convertAndDownload, 
  convertWordToPdfDirect, 
  convertPdfToWordDirect 
} from '../utils/fileConverter';
import './ConvertPage.css';

const SUPPORTED_FORMATS = [
  { id: 'docx', name: 'Word Document (.docx)', icon: <FileText size={18} />, color: '#3b82f6' },
  { id: 'pdf', name: 'PDF Document (.pdf)', icon: <FileText size={18} />, color: '#ef4444' },
  { id: 'xlsx', name: 'Excel Spreadsheet (.xlsx)', icon: <FileSpreadsheet size={18} />, color: '#10b981' },
  { id: 'csv', name: 'CSV File (.csv)', icon: <FileSpreadsheet size={18} />, color: '#059669' },
  { id: 'txt', name: 'Plain Text (.txt)', icon: <FileText size={18} />, color: '#9ca3af' },
  { id: 'md', name: 'Markdown (.md)', icon: <FileCode size={18} />, color: '#8b5cf6' },
  { id: 'html', name: 'HTML Webpage (.html)', icon: <FileCode size={18} />, color: '#f59e0b' },
  { id: 'json', name: 'JSON Document (.json)', icon: <FileCode size={18} />, color: '#ec4899' },
  { id: 'png', name: 'PNG Image (.png)', icon: <FileImage size={18} />, color: '#14b8a6' },
  { id: 'jpg', name: 'JPEG Image (.jpg)', icon: <FileImage size={18} />, color: '#06b6d4' }
];

/**
 * Custom Dropdown Selector matching user screenshot design.
 */
const CustomFormatDropdown = ({ selectedId, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedFormat = SUPPORTED_FORMATS.find(f => f.id === selectedId) || SUPPORTED_FORMATS[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="custom-dropdown-container" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        type="button" 
        className="dropdown-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: selectedFormat.color, display: 'flex', alignItems: 'center' }}>
            {selectedFormat.icon}
          </span>
          <span className="font-medium text-sm">{selectedFormat.name}</span>
        </span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popup Menu List matching attachment screenshot */}
      {isOpen && (
        <div className="dropdown-popup-menu">
          <div className="dropdown-menu-header px-3 py-2 text-xs font-semibold text-muted uppercase border-b border-white/10">
            Select Target Format
          </div>
          <div className="dropdown-menu-list">
            {SUPPORTED_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                className={`dropdown-item-btn ${selectedId === fmt.id ? 'active' : ''}`}
                onClick={() => {
                  onSelect(fmt.id);
                  setIsOpen(false);
                }}
              >
                <span className="item-icon" style={{ color: fmt.color }}>
                  {fmt.icon}
                </span>
                <span className="item-name">{fmt.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ConvertPage = () => {
  usePageTitle('Document & File Converter');

  const [activeFile, setActiveFile] = useState(null);
  const [htmlContent, setHtmlContent] = useState('<h1>Welcome to File Converter!</h1><p>Upload a file using the drop zone above or start editing right here. You can format text, add tables, images, links, change colors, and convert your work to Word, PDF, Excel, Text, Markdown, HTML, JSON, or Image format.</p>');
  const [targetFormat, setTargetFormat] = useState('docx');
  const [outputFilename, setOutputFilename] = useState('converted_document');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [conversionMode, setConversionMode] = useState('editor'); // 'editor' | 'word-to-pdf' | 'pdf-to-word'

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // File Upload Processing
  const processUploadedFile = async (file) => {
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    setIsParsing(true);
    setStatusMessage(null);

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setOutputFilename(`${baseName}_converted`);

    setActiveFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type || ext.toUpperCase(),
      rawFile: file
    });

    try {
      // 1. Direct Word -> PDF Instant Conversion
      if (conversionMode === 'word-to-pdf' || (ext === 'docx' && targetFormat === 'pdf')) {
        setTargetFormat('pdf');
        setStatusMessage({ type: 'info', text: `Converting "${file.name}" directly to PDF...` });
        
        // Populate editor in background
        const parsedHtml = await parseFileToHtml(file);
        setHtmlContent(parsedHtml);

        // Immediate Direct Conversion & Download
        await convertWordToPdfDirect(file, `${baseName}_converted`);
        setStatusMessage({ type: 'success', text: `Word to PDF conversion complete! "${baseName}_converted.pdf" has been downloaded.` });
        setIsParsing(false);
        return;
      }

      // 2. Direct PDF -> Word Instant Conversion
      if (conversionMode === 'pdf-to-word' || (ext === 'pdf' && targetFormat === 'docx')) {
        setTargetFormat('docx');
        setStatusMessage({ type: 'info', text: `Converting "${file.name}" directly to Word...` });
        
        // Populate editor in background
        const parsedHtml = await parseFileToHtml(file);
        setHtmlContent(parsedHtml);

        // Immediate Direct Conversion & Download
        await convertPdfToWordDirect(file, `${baseName}_converted`);
        setStatusMessage({ type: 'success', text: `PDF to Word conversion complete! "${baseName}_converted.doc" has been downloaded.` });
        setIsParsing(false);
        return;
      }

      // Standard Editor Mode parsing
      const parsedHtml = await parseFileToHtml(file);
      setHtmlContent(parsedHtml);
      setStatusMessage({ type: 'success', text: `Successfully loaded and parsed "${file.name}"` });
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

  // Convert and Export Download
  const handleConvert = async () => {
    setIsConverting(true);
    setStatusMessage(null);

    try {
      const ext = activeFile && activeFile.name ? (activeFile.name.split('.').pop() || '').toLowerCase() : '';

      // Direct file conversion if original uploaded file is active
      if (activeFile && activeFile.rawFile) {
        if (ext === 'docx' && targetFormat === 'pdf') {
          await convertWordToPdfDirect(activeFile.rawFile, outputFilename);
          setStatusMessage({ type: 'success', text: `Word to PDF conversion complete! "${outputFilename}.pdf" downloaded.` });
          setIsConverting(false);
          return;
        }
        if (ext === 'pdf' && (targetFormat === 'docx' || targetFormat === 'doc')) {
          await convertPdfToWordDirect(activeFile.rawFile, outputFilename);
          setStatusMessage({ type: 'success', text: `PDF to Word conversion complete! "${outputFilename}.doc" downloaded.` });
          setIsConverting(false);
          return;
        }
      }

      if (!htmlContent || !htmlContent.trim()) {
        setStatusMessage({ type: 'error', text: 'Editor is empty. Please add content before converting.' });
        setIsConverting(false);
        return;
      }

      const currentHtml = editorRef.current ? editorRef.current.innerHTML : htmlContent;
      const editorCanvasEl = editorRef.current || document.querySelector('.rich-editor-canvas');

      await convertAndDownload(currentHtml, targetFormat, outputFilename, editorCanvasEl);

      const targetInfo = SUPPORTED_FORMATS.find(f => f.id === targetFormat);
      setStatusMessage({ 
        type: 'success', 
        text: `File successfully converted and downloaded as ${targetInfo ? targetInfo.name : targetFormat.toUpperCase()}!` 
      });
    } catch (err) {
      console.error('Conversion error:', err);
      setStatusMessage({ type: 'error', text: `Conversion failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsConverting(false);
    }
  };

  // Reset Editor
  const handleReset = () => {
    setActiveFile(null);
    setHtmlContent('<p></p>');
    setOutputFilename('converted_document');
    setStatusMessage(null);
  };

  return (
    <div className="convert-page container py-6 px-4">
      <ToolHeader 
        title="Document & File Converter" 
        description="Convert Word, PDF, Excel, Text, Markdown, HTML, JSON, and Images. Includes instant Word to PDF & PDF to Word conversion and rich text editing."
        icon={FileText}
        color="var(--primary)"
      />

      {/* Mode Quick Switcher Bar */}
      <div className="mode-switcher-tabs flex flex-wrap gap-2 mb-6">
        <button 
          className={`mode-tab-btn ${conversionMode === 'editor' ? 'active' : ''}`}
          onClick={() => setConversionMode('editor')}
        >
          <Sparkles size={16} /> Standard Converter & Editor
        </button>
        <button 
          className={`mode-tab-btn ${conversionMode === 'word-to-pdf' ? 'active' : ''}`}
          onClick={() => {
            setConversionMode('word-to-pdf');
            setTargetFormat('pdf');
          }}
        >
          <Zap size={16} className="text-amber-400" /> Instant Word to PDF
        </button>
        <button 
          className={`mode-tab-btn ${conversionMode === 'pdf-to-word' ? 'active' : ''}`}
          onClick={() => {
            setConversionMode('pdf-to-word');
            setTargetFormat('docx');
          }}
        >
          <Zap size={16} className="text-blue-400" /> Instant PDF to Word
        </button>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className={`status-banner mb-6 p-4 rounded-xl flex items-center justify-between glass ${statusMessage.type === 'error' ? 'banner-error' : statusMessage.type === 'info' ? 'banner-info' : 'banner-success'}`}>
          <div className="flex items-center gap-3">
            {statusMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
          <button className="btn btn-ghost btn-xs p-1" onClick={() => setStatusMessage(null)}>×</button>
        </div>
      )}

      {/* Quick Direct Conversion Feature Cards for Word <-> PDF */}
      {(conversionMode === 'word-to-pdf' || conversionMode === 'pdf-to-word') && (
        <div className="direct-mode-card glass-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={22} className="text-amber-400" />
            <h3 className="text-lg font-bold">
              {conversionMode === 'word-to-pdf' ? 'Instant Word to PDF Conversion' : 'Instant PDF to Word Conversion'}
            </h3>
          </div>
          <p className="text-xs text-muted mb-4">
            Upload your {conversionMode === 'word-to-pdf' ? 'Word (.docx)' : 'PDF (.pdf)'} document below. The output file will be converted and downloaded immediately upon upload!
          </p>
        </div>
      )}

      {/* File Upload Dropzone Section */}
      <div className="upload-section mb-6">
        <div 
          className={`dropzone-card glass-card ${isDragging ? 'dragging' : ''} ${isParsing ? 'parsing' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
            accept={
              conversionMode === 'word-to-pdf' ? '.docx,.doc' :
              conversionMode === 'pdf-to-word' ? '.pdf' :
              '.docx,.doc,.pdf,.xlsx,.xls,.csv,.txt,.md,.html,.htm,.json,.png,.jpg,.jpeg,.webp,.svg'
            }
          />

          {isParsing ? (
            <div className="dropzone-body flex flex-col items-center justify-center py-6">
              <RefreshCw size={36} className="animate-spin text-primary mb-2" />
              <h4 className="text-base font-semibold">Processing & Converting File...</h4>
              <p className="text-xs text-muted">Parsing content and generating converted download</p>
            </div>
          ) : (
            <div className="dropzone-body flex flex-col md:flex-row items-center justify-between p-6 gap-4" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="dropzone-icon-badge">
                  <Upload size={28} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    Drag & Drop file here or <span className="text-gradient">Browse</span>
                  </h3>
                  <p className="text-xs text-muted max-w-lg mt-1">
                    {conversionMode === 'word-to-pdf' ? 'Upload Word (.docx) file for instant PDF conversion.' :
                     conversionMode === 'pdf-to-word' ? 'Upload PDF (.pdf) file for instant Word conversion.' :
                     'Supports Word (.docx), PDF (.pdf), Excel (.xlsx, .csv), Text, Markdown, HTML, JSON, and Images.'}
                  </p>
                </div>
              </div>

              <div className="format-pills-container flex flex-wrap gap-1.5 justify-center md:justify-end max-w-sm">
                <span className="pill pill-blue">Word</span>
                <span className="pill pill-red">PDF</span>
                <span className="pill pill-green">Excel/CSV</span>
                <span className="pill pill-purple">Text & MD</span>
                <span className="pill pill-amber">HTML/JSON</span>
                <span className="pill pill-teal">Images</span>
              </div>
            </div>
          )}
        </div>

        {/* Active File Strip */}
        {activeFile && (
          <div className="active-file-strip glass mt-3 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <File className="text-primary flex-shrink-0" size={20} />
              <div className="truncate">
                <h4 className="font-semibold text-xs truncate">{activeFile.name}</h4>
                <span className="text-[11px] text-muted">{activeFile.type} • {activeFile.size}</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-xs text-danger flex items-center gap-1 flex-shrink-0" onClick={handleReset} title="Clear content and load new file">
              <Trash2 size={14} /> <span>Clear File</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Unified Editor & Conversion Workspace */}
      <div className="workspace-card glass-card p-4 md:p-6 mb-8">
        {/* Workspace Conversion Bar with Custom Dropdown matching Attachment Screenshot */}
        <div className="conversion-bar flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold">Document Editor & Export Settings</h3>
              <p className="text-xs text-muted hidden sm:block">Select target document format, edit preview content, and download</p>
            </div>
          </div>

          <div className="conversion-controls flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Custom Dropdown Selector */}
            <CustomFormatDropdown 
              selectedId={targetFormat} 
              onSelect={(id) => setTargetFormat(id)} 
            />

            {/* Output Filename Input */}
            <div className="filename-input-wrapper flex items-center">
              <input 
                type="text" 
                value={outputFilename} 
                onChange={(e) => setOutputFilename(e.target.value)} 
                className="filename-field"
                placeholder="filename"
              />
              <span className="extension-badge">.{targetFormat}</span>
            </div>

            {/* Convert CTA Button */}
            <button 
              type="button" 
              className="btn btn-primary convert-cta-btn flex items-center justify-center gap-2 px-5 py-2.5"
              onClick={handleConvert}
              disabled={isConverting}
            >
              {isConverting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> <span>Converting...</span>
                </>
              ) : (
                <>
                  <Download size={16} /> <span>Convert & Download</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Embedded Rich Text Editor */}
        <div className="editor-container w-full overflow-hidden">
          <RichTextEditor 
            value={htmlContent} 
            onChange={setHtmlContent} 
            editorRef={editorRef}
          />
        </div>
      </div>
    </div>
  );
};

export default ConvertPage;
