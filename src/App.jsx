import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import CodeFormatter from './pages/CodeFormatter';
import CodeCompiler from './pages/CodeCompiler';
import CodeMinifier from './pages/CodeMinifier';
import CodeReviewer from './pages/CodeReviewer';
import CodeOptimizer from './pages/CodeOptimizer';
import QrGenerator from './pages/QrGenerator';
import BarcodeGenerator from './pages/BarcodeGenerator';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

function App() {
  return (
    <Router>
      <Navbar />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/format" element={<CodeFormatter />} />
          <Route path="/compile" element={<CodeCompiler />} />
          <Route path="/minify" element={<CodeMinifier />} />
          <Route path="/review" element={<CodeReviewer />} />
          <Route path="/optimize" element={<CodeOptimizer />} />
          <Route path="/qr-code" element={<QrGenerator />} />
          <Route path="/barcode" element={<BarcodeGenerator />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </div>
      <Footer />
    </Router>
  );
}

export default App;
