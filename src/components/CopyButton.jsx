import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

/** Small copy-to-clipboard button with a brief "copied" state. */
const CopyButton = ({ text, label, className = 'btn btn-ghost btn-xs', title = 'Copy', size = 14, disabled }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context or denied permission): nothing useful to do
    }
  };

  return (
    <button type="button" className={className} onClick={handleCopy} title={title} disabled={disabled ?? !text}>
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
};

export default CopyButton;
