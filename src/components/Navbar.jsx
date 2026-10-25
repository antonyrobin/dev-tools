import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Code2, Menu, X, Star, ChevronDown, Home as HomeIcon } from 'lucide-react';
import { TOOLS, PRIMARY_TOOL_PATHS } from '../data/tools';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const location = useLocation();

  const primaryTools = TOOLS.filter(t => PRIMARY_TOOL_PATHS.includes(t.path));
  const moreTools = TOOLS.filter(t => !PRIMARY_TOOL_PATHS.includes(t.path));
  const moreActive = moreTools.some(t => t.path === location.pathname);

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
            <NavLink key={tool.path} to={tool.path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
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
              <span>More tools</span>
              <ChevronDown size={15} className={`nav-chevron ${moreOpen ? 'open' : ''}`} />
            </button>
            {moreOpen && (
              <div className="nav-more-menu" role="menu">
                {moreTools.map((tool) => (
                  <NavLink key={tool.path} to={tool.path} className={({ isActive }) => `nav-more-item ${isActive ? 'active' : ''}`} role="menuitem">
                    <span className="nav-more-icon" style={{ color: tool.color, background: `${tool.color}1f` }}>
                      <tool.icon size={16} />
                    </span>
                    <span className="nav-more-text">
                      <span className="nav-more-title">{tool.title}</span>
                      <span className="nav-more-desc">{tool.description}</span>
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="navbar-right">
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
          <div className="mobile-grid">
            {TOOLS.map((tool) => (
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
      )}
    </nav>
  );
};

export default Navbar;
