import { useState, useEffect } from 'react';

const STORAGE_KEY = 'devtools:theme';
const THEME_COLORS = { dark: '#0a0a0e', light: '#f4f5fa' };

const readPreference = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
};

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

/**
 * Theme preference: 'system' | 'light' | 'dark'.
 * The resolved theme is written to <html data-theme>; index.html applies it before first paint.
 */
export default function useTheme() {
  const [preference, setPreference] = useState(readPreference);
  const [resolved, setResolved] = useState(() => (preference === 'system' ? systemTheme() : preference));

  useEffect(() => {
    const apply = () => {
      const theme = preference === 'system' ? systemTheme() : preference;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
      setResolved(theme);
    };
    apply();
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only
    }
    if (preference !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [preference]);

  return { preference, setPreference, resolved };
}
