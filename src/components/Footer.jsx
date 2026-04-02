import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer glass">
      <div className="container footer-content">
        <div className="footer-brand">
          <h3 className="footer-logo">Dev<span className="text-gradient">Tools</span></h3>
          <p className="footer-desc">
            An open-source suite of powerful developer tools. Format, minify, compile, and generate codes seamlessly.
          </p>
          <div className="security-badge">
            <ShieldCheck size={18} className="text-success" />
            <span>Protected by Cloudflare Turnstile</span>
          </div>
        </div>

        <div className="footer-links-group">
          <h4>Tools</h4>
          <Link to="/format">Code Formatter</Link>
          <Link to="/compile">Code Compiler</Link>
          <Link to="/minify">Code Minifier</Link>
          <Link to="/qr-code">QR / Barcode</Link>
        </div>

        <div className="footer-links-group">
          <h4>Legal</h4>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <a href="https://github.com/antonyrobin/dev-tools" target="_blank" rel="noreferrer">Open Source</a>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container flex justify-between items-center bottom-content">
          <p>&copy; {new Date().getFullYear()} DevTools. All rights reserved.</p>
          <p className="flex items-center gap-2">Built with <Heart size={14} className="text-danger" /> for developers</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
