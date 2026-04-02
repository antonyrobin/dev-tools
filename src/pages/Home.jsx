import React from 'react';
import { Link } from 'react-router-dom';
import { Code, Zap, FileJson, Cpu, QrCode, ShieldCheck, ArrowRight, AlignJustify } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import usePageTitle from '../hooks/usePageTitle';
import './Home.css';

const features = [
  {
    icon: <FileJson size={24} />,
    title: "Code Formatter",
    description: "Instantly beautify your HTML, CSS, JavaScript, and JSON code.",
    path: "/format",
    color: "var(--primary)"
  },
  {
    icon: <Zap size={24} />,
    title: "Code Minifier",
    description: "Compress your code for production to boost load speeds.",
    path: "/minify",
    color: "var(--secondary)"
  },
  {
    icon: <Cpu size={24} />,
    title: "Code Compiler",
    description: "Run and test JavaScript snippets instantly in the browser.",
    path: "/compile",
    color: "var(--success)"
  },
  {
    icon: <Code size={24} />,
    title: "Code Optimizer",
    description: "Analyze and optimize code logic using automated reviews.",
    path: "/optimize",
    color: "var(--warning)"
  },
  {
    icon: <QrCode size={24} />,
    title: "QR Generator",
    description: "Create beautiful, customized QR codes instantly.",
    path: "/qr-code",
    color: "var(--info)"
  },
  {
    icon: <AlignJustify size={24} />,
    title: "Barcode Generator",
    description: "Generate sequential barcodes for inventory and tracking.",
    path: "/barcode",
    color: "var(--accent)"
  }
];

const Home = () => {
  usePageTitle('Home');
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container text-center">
          <div className="hero-badge animate-fade-in glass">
            <ShieldCheck size={16} className="text-secondary" />
            <span>Open Source & Free Forever</span>
          </div>
          
          <h1 className="hero-title animate-fade-in text-gradient" style={{ animationDelay: '0.1s' }}>
            The Ultimate Toolkit <br/> for Modern Developers
          </h1>
          
          <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Format, minify, compile, review, and generate codes all in one place. 
            Built for speed, security, and developer productivity.
          </p>
          
          <div className="hero-cta animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Link to="/format" className="btn btn-primary btn-lg">
              Start Formatting <ArrowRight size={18} />
            </Link>
            <a href="https://github.com/antonyrobin/dev-tools" target="_blank" rel="noreferrer" className="btn btn-outline btn-lg glass">
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section container">
        <div className="section-header text-center mb-8">
          <h2>Powerful Tools</h2>
          <p>Everything you need to write better code, faster.</p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <Link to={feature.path} key={index} className="feature-card glass-card">
              <div className="feature-icon" style={{ background: `${feature.color}22`, color: feature.color }}>
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.description}</p>
              <div className="feature-action">
                <span>Try it out</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Security Info */}
      <section className="security-section container mt-8 mb-8">
        <div className="security-card glass flex items-center justify-between">
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
