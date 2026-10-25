import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Compact page header so the workspace (editors) gets most of the screen
const ToolHeader = ({ title, description, icon: Icon, color = 'var(--primary)', children }) => {
  return (
    <header className="tool-header animate-fade-in">
      <div className="tool-header-main">
        {Icon && (
          <div className="tool-header-icon" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
            <Icon size={22} />
          </div>
        )}
        <div className="tool-header-text">
          <nav className="tool-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Tools</Link>
            <ChevronRight size={12} />
            <span>{title}</span>
          </nav>
          <h1 className="tool-header-title">{title}</h1>
          {description && <p className="tool-header-desc">{description}</p>}
        </div>
      </div>
      {children && <div className="tool-header-extra">{children}</div>}

      <style>{`
        .tool-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .tool-header-main {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          min-width: 0;
        }
        .tool-header-icon {
          width: 46px;
          height: 46px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tool-header-text { min-width: 0; }
        .tool-breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 0.1rem;
        }
        .tool-breadcrumb a { color: var(--text-muted); }
        .tool-breadcrumb a:hover { color: var(--text-primary); }
        .tool-header-title {
          font-size: clamp(1.35rem, 2.4vw, 1.75rem);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .tool-header-desc {
          margin: 0.15rem 0 0;
          font-size: 0.9rem;
          color: var(--text-muted);
          max-width: 760px;
        }
        @media (max-width: 600px) {
          .tool-header-icon { width: 40px; height: 40px; }
          .tool-header-desc { font-size: 0.82rem; }
        }
      `}</style>
    </header>
  );
};

export default ToolHeader;
