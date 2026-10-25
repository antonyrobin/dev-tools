import { useState, useEffect } from 'react';

/**
 * Toggles a panel between inline and full-viewport mode.
 * Locks page scroll while maximized and exits on Escape (unless a child handled it).
 */
export default function useMaximize() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isMaximized) return;
    document.body.classList.add('has-maximized-panel');
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setIsMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('has-maximized-panel');
      window.removeEventListener('keydown', onKey);
    };
  }, [isMaximized]);

  return [isMaximized, setIsMaximized];
}
