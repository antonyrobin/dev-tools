import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Table as TableIcon, 
  Palette, Type, Heading1, Heading2, Heading3, Code, Quote, Minus, RotateCcw, RotateCw,
  RemoveFormatting, FileCode, Eye, Subscript, Superscript
} from 'lucide-react';
import './RichTextEditor.css';

const FONT_FAMILIES = [
  { label: 'Standard (Inter)', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' }
];

const FONT_SIZES = [
  { label: '12px', value: '1' },
  { label: '14px', value: '2' },
  { label: '16px (Normal)', value: '3' },
  { label: '18px', value: '4' },
  { label: '24px (Large)', value: '5' },
  { label: '32px (Huge)', value: '6' }
];

const RichTextEditor = ({ value = '', onChange, editorRef }) => {
  const innerRef = useRef(null);
  const [showSource, setShowSource] = useState(false);
  const [sourceCode, setSourceCode] = useState(value);
  const [textColor, setTextColor] = useState('#6366f1');
  const [bgColor, setBgColor] = useState('#fef08a');
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // Stats state
  const [stats, setStats] = useState({ words: 0, chars: 0 });

  const activeEditorRef = editorRef || innerRef;

  // Sync initial content
  useEffect(() => {
    if (activeEditorRef.current && !showSource) {
      if (activeEditorRef.current.innerHTML !== value) {
        activeEditorRef.current.innerHTML = value || '<p><br></p>';
      }
      updateStats();
    }
  }, [value, showSource]);

  // Update Stats
  const updateStats = () => {
    if (!activeEditorRef.current) return;
    const text = activeEditorRef.current.innerText || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setStats({ words, chars });
  };

  const handleInput = () => {
    if (activeEditorRef.current) {
      const html = activeEditorRef.current.innerHTML;
      if (onChange) onChange(html);
      setSourceCode(html);
      updateStats();
    }
  };

  const execCommand = (command, value = null) => {
    if (showSource) return;
    document.execCommand(command, false, value);
    if (activeEditorRef.current) {
      activeEditorRef.current.focus();
      handleInput();
    }
  };

  // Heading / Block Format
  const handleBlockFormat = (tag) => {
    if (showSource) return;
    execCommand('formatBlock', `<${tag}>`);
  };

  // Font Family
  const handleFontFamily = (font) => {
    execCommand('fontName', font);
  };

  // Font Size
  const handleFontSize = (size) => {
    execCommand('fontSize', size);
  };

  // Color Application
  const applyTextColor = (color) => {
    setTextColor(color);
    execCommand('foreColor', color);
  };

  const applyBgColor = (color) => {
    setBgColor(color);
    execCommand('hiliteColor', color);
  };

  // Insert Table
  const insertTable = () => {
    if (tableRows <= 0 || tableCols <= 0) return;
    let tableHtml = '<table class="editor-table" style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid #4b5563;"><thead><tr>';
    for (let c = 1; c <= tableCols; c++) {
      tableHtml += `<th style="border:1px solid #4b5563; padding:8px 12px; background-color:rgba(99,102,241,0.2); font-weight:600;">Header ${c}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 1; r <= tableRows - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `<td style="border:1px solid #4b5563; padding:8px 12px;">Cell ${r},${c}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';

    execCommand('insertHTML', tableHtml);
    setShowTableModal(false);
  };

  // Insert Link
  const insertLink = () => {
    if (!linkUrl) return;
    const selection = window.getSelection().toString();
    const textToInsert = linkText || selection || linkUrl;
    const anchorHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary); text-decoration:underline;">${textToInsert}</a>`;
    execCommand('insertHTML', anchorHtml);
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Insert Image
  const insertImage = (url) => {
    const src = url || imageUrl;
    if (!src) return;
    const imgHtml = `<div style="text-align:center; margin:16px 0;"><img src="${src}" alt="Inserted Image" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3);" /></div><p><br></p>`;
    execCommand('insertHTML', imgHtml);
    setShowImageModal(false);
    setImageUrl('');
  };

  const handleImageFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        insertImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle Source Mode
  const toggleSourceView = () => {
    if (!showSource) {
      if (activeEditorRef.current) {
        setSourceCode(activeEditorRef.current.innerHTML);
      }
      setShowSource(true);
    } else {
      setShowSource(false);
      if (onChange) onChange(sourceCode);
    }
  };

  const handleSourceChange = (e) => {
    const val = e.target.value;
    setSourceCode(val);
    if (onChange) onChange(val);
  };

  return (
    <div className="rich-editor-wrapper glass-card">
      {/* Editor Toolbar */}
      <div className="rich-editor-toolbar">
        {/* Undo / Redo */}
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)">
            <RotateCcw size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)">
            <RotateCw size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Font Family & Size */}
        <div className="toolbar-group">
          <select 
            className="toolbar-select font-family-select"
            onChange={(e) => handleFontFamily(e.target.value)}
            defaultValue="Inter, sans-serif"
            disabled={showSource}
            title="Font Family"
          >
            {FONT_FAMILIES.map((f, i) => (
              <option key={i} value={f.value}>{f.label}</option>
            ))}
          </select>

          <select 
            className="toolbar-select font-size-select"
            onChange={(e) => handleFontSize(e.target.value)}
            defaultValue="3"
            disabled={showSource}
            title="Font Size"
          >
            {FONT_SIZES.map((s, i) => (
              <option key={i} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-divider" />

        {/* Formatting Buttons */}
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={() => execCommand('bold')} title="Bold (Ctrl+B)" disabled={showSource}>
            <Bold size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('italic')} title="Italic (Ctrl+I)" disabled={showSource}>
            <Italic size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('underline')} title="Underline (Ctrl+U)" disabled={showSource}>
            <Underline size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('strikeThrough')} title="Strikethrough" disabled={showSource}>
            <Strikethrough size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('subscript')} title="Subscript" disabled={showSource}>
            <Subscript size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('superscript')} title="Superscript" disabled={showSource}>
            <Superscript size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Headings */}
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={() => handleBlockFormat('h1')} title="Heading 1" disabled={showSource}>
            <Heading1 size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => handleBlockFormat('h2')} title="Heading 2" disabled={showSource}>
            <Heading2 size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => handleBlockFormat('h3')} title="Heading 3" disabled={showSource}>
            <Heading3 size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => handleBlockFormat('blockquote')} title="Blockquote" disabled={showSource}>
            <Quote size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => handleBlockFormat('pre')} title="Code Block" disabled={showSource}>
            <Code size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text & Background Color */}
        <div className="toolbar-group color-picker-group">
          <label className="color-picker-label" title="Text Color">
            <Type size={16} style={{ color: textColor }} />
            <input 
              type="color" 
              value={textColor} 
              onChange={(e) => applyTextColor(e.target.value)} 
              disabled={showSource}
            />
          </label>

          <label className="color-picker-label" title="Highlight / Background Color">
            <Palette size={16} style={{ color: bgColor }} />
            <input 
              type="color" 
              value={bgColor} 
              onChange={(e) => applyBgColor(e.target.value)} 
              disabled={showSource}
            />
          </label>
        </div>

        <div className="toolbar-divider" />

        {/* Alignment & Lists */}
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={() => execCommand('justifyLeft')} title="Align Left" disabled={showSource}>
            <AlignLeft size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('justifyCenter')} title="Align Center" disabled={showSource}>
            <AlignCenter size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('justifyRight')} title="Align Right" disabled={showSource}>
            <AlignRight size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('justifyFull')} title="Justify" disabled={showSource}>
            <AlignJustify size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('insertUnorderedList')} title="Bullet List" disabled={showSource}>
            <List size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('insertOrderedList')} title="Numbered List" disabled={showSource}>
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Insertables */}
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" onClick={() => setShowTableModal(true)} title="Insert Table" disabled={showSource}>
            <TableIcon size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setShowLinkModal(true)} title="Insert Link" disabled={showSource}>
            <LinkIcon size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setShowImageModal(true)} title="Insert Image" disabled={showSource}>
            <ImageIcon size={16} />
          </button>
          <button type="button" className="toolbar-btn" onClick={() => execCommand('insertHorizontalRule')} title="Horizontal Divider Line" disabled={showSource}>
            <Minus size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Clear & View Source */}
        <div className="toolbar-group ml-auto">
          <button type="button" className="toolbar-btn" onClick={() => execCommand('removeFormat')} title="Clear Formatting" disabled={showSource}>
            <RemoveFormatting size={16} />
          </button>
          <button 
            type="button" 
            className={`toolbar-btn ${showSource ? 'active' : ''}`} 
            onClick={toggleSourceView} 
            title={showSource ? "Switch to WYSIWYG View" : "View/Edit HTML Source"}
          >
            {showSource ? <Eye size={16} /> : <FileCode size={16} />}
          </button>
        </div>
      </div>

      {/* Main Canvas / Editor Container */}
      <div className="rich-editor-content-wrapper">
        {showSource ? (
          <textarea
            className="rich-editor-source-textarea"
            value={sourceCode}
            onChange={handleSourceChange}
            placeholder="Edit HTML source code here..."
          />
        ) : (
          <div
            ref={activeEditorRef}
            className="rich-editor-canvas"
            contentEditable
            onInput={handleInput}
            onKeyUp={updateStats}
            onMouseUp={updateStats}
            suppressContentEditableWarning
          />
        )}
      </div>

      {/* Editor Footer Stats */}
      <div className="rich-editor-footer flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>Words: <strong>{stats.words}</strong></span>
          <span>Characters: <strong>{stats.chars}</strong></span>
        </div>
        <div className="text-xs text-muted">
          {showSource ? 'HTML Code View' : 'Rich Text WYSIWYG Mode'}
        </div>
      </div>

      {/* Table Insertion Modal */}
      {showTableModal && (
        <div className="modal-backdrop flex items-center justify-center">
          <div className="modal-card glass p-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TableIcon size={20} className="text-primary" /> Insert Table
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs mb-1 font-semibold">Rows</label>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={tableRows} 
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 font-semibold">Columns</label>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={tableCols} 
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowTableModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={insertTable}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="modal-backdrop flex items-center justify-center">
          <div className="modal-card glass p-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <LinkIcon size={20} className="text-primary" /> Insert Link
            </h4>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs mb-1 font-semibold">URL</label>
                <input 
                  type="url" 
                  placeholder="https://example.com" 
                  value={linkUrl} 
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 font-semibold">Link Text (Optional)</label>
                <input 
                  type="text" 
                  placeholder="Click here" 
                  value={linkText} 
                  onChange={(e) => setLinkText(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowLinkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={insertLink}>Insert Link</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="modal-backdrop flex items-center justify-center">
          <div className="modal-card glass p-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ImageIcon size={20} className="text-primary" /> Insert Image
            </h4>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs mb-1 font-semibold">Upload Image File</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageFileUpload}
                  className="input-field"
                />
              </div>
              <div className="text-center text-xs text-muted">OR</div>
              <div>
                <label className="block text-xs mb-1 font-semibold">Image URL</label>
                <input 
                  type="url" 
                  placeholder="https://example.com/image.png" 
                  value={imageUrl} 
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowImageModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => insertImage()}>Insert Image</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
