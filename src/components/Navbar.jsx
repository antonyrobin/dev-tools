import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Code2, Menu, X, Sparkles } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Format', path: '/format' },
    { name: 'QR Code', path: '/qr-code' },
    { name: 'Barcode', path: '/barcode' },
  ];

  return (
    <nav className="navbar glass">
      <div className="container navbar-container">
        <Link to="/" className="navbar-logo">
          <Code2 size={28} className="logo-icon" />
          <span className="logo-text">Dev<span className="text-gradient">Tools</span></span>
        </Link>

        {/* Desktop Menu */}
        <div className="nav-links desktop-menu">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.name}
            </Link>
          ))}
          <a href="https://github.com/antonyrobin/dev-tools" target="_blank" rel="noreferrer" className="btn btn-outline btn-github glass-card">
            <Sparkles size={18} />
            Star on GitHub
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <button className="mobile-toggle btn-ghost" onClick={toggleMenu}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="mobile-menu glass">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`mobile-link ${location.pathname === link.path ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
