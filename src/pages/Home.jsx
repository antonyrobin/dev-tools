import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Search, Lock, Gauge } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import usePageTitle from '../hooks/usePageTitle';
import { TOOLS, CATEGORIES as TOOL_CATEGORIES } from '../data/tools';
import './Home.css';

const CATEGORIES = [{ id: 'all', label: 'All tools' }, ...TOOL_CATEGORIES];

const HIGHLIGHTS = [
  { icon: Lock, title: '100% client-side', text: 'Files and code are processed in your browser and never uploaded. Works offline too.' },
  { icon: Gauge, title: 'Built for big files', text: 'Fast find, folding and diffing that stay smooth on thousands of lines.' },
  { icon: ShieldCheck, title: 'Free & open source', text: 'No sign-up, no tracking walls. Inspect and contribute on GitHub.' },
];

const Home = () => {
  usePageTitle('Home');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter(t =>
      (category === 'all' || t.category === category) &&
      (!q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    );
  }, [query, category]);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container text-center">
          <div className="hero-badge animate-fade-in glass">
            <ShieldCheck size={16} className="text-secondary" />
            <span>Open Source & Free Forever</span>
          </div>

          <h1 className="hero-title animate-fade-in">
            The developer toolkit <br className="hide-mobile-text" />
            <span className="text-gradient">that stays out of your way</span>
          </h1>

          <p className="hero-subtitle animate-fade-in">
            Format, compare, convert, encode, decode and generate — all in one fast, private, browser-based workspace that also works offline.
          </p>

          <div className="hero-search animate-fade-in">
            <Search size={18} className="hero-search-icon" />
            <input
              type="search"
              placeholder="Search tools… e.g. json, yaml, jwt, regex, uuid"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tools"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section container">
        <div className="features-filter">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`filter-chip ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="features-grid">
          {visibleTools.map((tool) => (
            <Link to={tool.path} key={tool.path} className="feature-card glass-card">
              <div className="feature-icon" style={{ background: `${tool.color}22`, color: tool.color }}>
                <tool.icon size={22} />
              </div>
              <h3 className="feature-title">{tool.title}</h3>
              <p className="feature-desc">{tool.description}</p>
              <div className="feature-action">
                <span>Open tool</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}
          {visibleTools.length === 0 && (
            <div className="col-span-full text-center text-muted p-8">No tools match “{query}”.</div>
          )}
        </div>
      </section>

      {/* Highlights */}
      <section className="container highlights-grid">
        {HIGHLIGHTS.map(h => (
          <div key={h.title} className="highlight-item">
            <div className="highlight-icon"><h.icon size={20} /></div>
            <div>
              <h4>{h.title}</h4>
              <p>{h.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Security Info */}
      <section className="security-section container">
        <div className="security-card glass">
          <div>
            <h3>Enterprise Grade Security</h3>
            <p className="mb-0">Protected by Cloudflare Turnstile bot management. Advanced privacy checks embedded.</p>
          </div>
          <div className="turnstile-container">
            <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
