import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart } from 'lucide-react';
import { TOOLS } from '../data/tools';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h3 className="footer-logo">Dev<span className="text-gradient">Tools</span></h3>
          <p className="footer-desc">
            An open-source suite of developer tools. Everything runs in your browser — your code and documents never leave your device.
          </p>
          <div className="security-badge">
            <ShieldCheck size={16} className="text-success" />
            <span>Protected by Cloudflare Turnstile</span>
          </div>
        </div>

        <div className="footer-links-group">
          <h4>Tools</h4>
          <div className="footer-links-grid">
            {TOOLS.map(tool => (
              <Link key={tool.path} to={tool.path}>{tool.title}</Link>
            ))}
          </div>
        </div>

        <div className="footer-links-group">
          <h4>Project</h4>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <a href="https://github.com/antonyrobin/dev-tools" target="_blank" rel="noreferrer">Source on GitHub</a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} DevTools. All rights reserved.</p>
        <p className="flex items-center gap-2">Built with <Heart size={14} className="text-danger" /> for developers</p>
      </div>
    </footer>
  );
};

export default Footer;
