import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Seo from './components/Seo';
import Home from './pages/Home';

import { ROUTE_LOADERS } from './data/routeLoaders';

// Tool pages are code-split so the home page doesn't download prettier, pdf.js, etc.
const LAZY_PAGES = Object.fromEntries(
  Object.entries(ROUTE_LOADERS).map(([path, load]) => [path, lazy(load)])
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Loading">
    <span className="page-loader-spinner" />
  </div>
);

function App() {
  return (
    <Router>
      <Seo />
      <ScrollToTop />
      <Navbar />
      <main className="page-container">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            {Object.entries(LAZY_PAGES).map(([path, page]) => (
              <Route key={path} path={path} element={React.createElement(page)} />
            ))}
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
