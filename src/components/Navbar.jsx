import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { prefetchRoute } from '../data/routeLoaders';
import { Code2, Menu, X, Star, ChevronDown, Home as HomeIcon, Sun, Moon, Monitor, WifiOff } from 'lucide-react';
import { TOOLS, PRIMARY_TOOL_PATHS, toolsByCategory } from '../data/tools';
import useTheme from '../hooks/useTheme';
import './Navbar.css';

const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' };
const THEME_META = {
  system: { icon: Monitor, label: 'System theme' },
  light: { icon: Sun, label: 'Light theme' },
  dark: { icon: Moon, label: 'Dark theme' },
};

const useOnlineStatus = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const location = useLocation();
  const { preference, setPreference } = useTheme();
  const online = useOnlineStatus();

  const primaryTools = TOOLS.filter(t => PRIMARY_TOOL_PATHS.includes(t.path));
  const moreGroups = toolsByCategory(TOOLS.filter(t => !PRIMARY_TOOL_PATHS.includes(t.path)));
  const moreActive = moreGroups.some(g => g.tools.some(t => t.path === location.pathname));
  const allGroups = toolsByCategory();

  // Close menus on navigation (state adjusted during render, no effect needed)
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setIsOpen(false);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  // Prevent page scroll behind the open mobile menu
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const ThemeIcon = THEME_META[preference].icon;
  const nextTheme = THEME_CYCLE[preference];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" aria-label="DevTools home">
          <Code2 size={26} className="logo-icon" />
          <span className="logo-text">Dev<span className="text-gradient">Tools</span></span>
        </Link>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          {primaryTools.map((tool) => (
            <NavLink key={tool.path} to={tool.path} onMouseEnter={() => prefetchRoute(tool.path)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <tool.icon size={16} />
              <span>{tool.name}</span>
            </NavLink>
          ))}

          <div className="nav-more" ref={moreRef}>
            <button
              type="button"
              className={`nav-link nav-more-trigger ${moreActive ? 'active' : ''}`}
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              <span>All tools</span>
              <ChevronDown size={15} className={`nav-chevron ${moreOpen ? 'open' : ''}`} />
            </button>
            {moreOpen && (
              <div className="nav-more-menu" role="menu">
                {moreGroups.map((group) => (
                  <div key={group.id} className="nav-more-group">
                    <div className="nav-more-heading">{group.label}</div>
                    {group.tools.map((tool) => (
                      <NavLink
                        key={tool.path}
                        to={tool.path}
                        onMouseEnter={() => prefetchRoute(tool.path)}
                        className={({ isActive }) => `nav-more-item ${isActive ? 'active' : ''}`}
                        role="menuitem"
                        title={tool.description}
                      >
                        <span className="nav-more-icon" style={{ color: tool.color, background: `${tool.color}1f` }}>
                          <tool.icon size={15} />
                        </span>
                        <span className="nav-more-title">{tool.title}</span>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="navbar-right">
          {!online && (
            <span className="offline-pill" title="You are offline. Tools you have opened before keep working.">
              <WifiOff size={14} />
              <span className="offline-label">Offline</span>
            </span>
          )}

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setPreference(nextTheme)}
            title={`${THEME_META[preference].label} — switch to ${THEME_META[nextTheme].label.toLowerCase()}`}
            aria-label={`${THEME_META[preference].label}. Switch to ${THEME_META[nextTheme].label.toLowerCase()}`}
          >
            <ThemeIcon size={18} />
          </button>

          <a href="https://github.com/antonyrobin/dev-tools" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm btn-github">
            <Star size={16} />
            <span className="github-label">Star on GitHub</span>
          </a>

          <button
            className="mobile-toggle"
            onClick={() => setIsOpen(o => !o)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="mobile-menu">
          <Link to="/" className={`mobile-link ${location.pathname === '/' ? 'active' : ''}`}>
            <span className="mobile-link-icon"><HomeIcon size={18} /></span>
            <span>Home</span>
          </Link>
          {allGroups.map((group) => (
            <div key={group.id} className="mobile-group">
              <div className="mobile-group-heading">{group.label}</div>
              <div className="mobile-grid">
                {group.tools.map((tool) => (
                  <Link
                    key={tool.path}
                    to={tool.path}
                    className={`mobile-link ${location.pathname === tool.path ? 'active' : ''}`}
                  >
                    <span className="mobile-link-icon" style={{ color: tool.color }}><tool.icon size={18} /></span>
                    <span>{tool.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
