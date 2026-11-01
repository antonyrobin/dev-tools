import React, { useState, useEffect, useRef } from 'react';
import { ImageUp } from 'lucide-react';
import { imageFilesFrom } from '../utils/image';

/**
 * Drop, choose or paste (Ctrl+V anywhere on the page) image files.
 * Renders `children` inside the drop area once something is loaded, else a hint.
 */
const ImageDropzone = ({ onFiles, multiple = false, hint, children, className = '' }) => {
  const [dragging, setDragging] = useState(false);
  const onFilesRef = useRef(onFiles);
  useEffect(() => { onFilesRef.current = onFiles; }, [onFiles]);

  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      const files = imageFilesFrom([...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean));
      if (!files.length) return;
      e.preventDefault();
      onFilesRef.current(multiple ? files : files.slice(0, 1));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [multiple]);

  const take = (list) => {
    const files = imageFilesFrom(list);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      className={`img-drop ${dragging ? 'dragging' : ''} ${children ? 'has-content' : ''} ${className}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files); }}
    >
      <input type="file" hidden accept="image/*,.svg,.ico,.avif" multiple={multiple} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {children || (
        <span className="img-drop-hint">
          <ImageUp size={30} />
          <strong>Drop, choose or paste {multiple ? 'images' : 'an image'}</strong>
          <span className="text-sm text-muted">{hint || 'PNG, JPEG, WebP, AVIF, GIF, BMP, SVG or ICO · processed locally'}</span>
        </span>
      )}
    </label>
  );
};

export default ImageDropzone;
