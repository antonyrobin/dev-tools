import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';

// Tool pages are code-split so the home page doesn't download prettier, pdf.js, etc.
const CodeFormatter = lazy(() => import('./pages/CodeFormatter'));
const CodeCompiler = lazy(() => import('./pages/CodeCompiler'));
const CodeMinifier = lazy(() => import('./pages/CodeMinifier'));
const CodeReviewer = lazy(() => import('./pages/CodeReviewer'));
const CodeOptimizer = lazy(() => import('./pages/CodeOptimizer'));
const QrGenerator = lazy(() => import('./pages/QrGenerator'));
const BarcodeGenerator = lazy(() => import('./pages/BarcodeGenerator'));
const TextCompare = lazy(() => import('./pages/TextCompare'));
const ConvertPage = lazy(() => import('./pages/ConvertPage'));
const FolderCompare = lazy(() => import('./pages/tools/FolderCompare'));
const DataConverter = lazy(() => import('./pages/tools/DataConverter'));
const JsonToTs = lazy(() => import('./pages/tools/JsonToTs'));
const JsonViewer = lazy(() => import('./pages/tools/JsonViewer'));
const Encoder = lazy(() => import('./pages/tools/Encoder'));
const JwtDecoder = lazy(() => import('./pages/tools/JwtDecoder'));
const UuidGenerator = lazy(() => import('./pages/tools/UuidGenerator'));
const HashGenerator = lazy(() => import('./pages/tools/HashGenerator'));
const PasswordGenerator = lazy(() => import('./pages/tools/PasswordGenerator'));
const LoremIpsum = lazy(() => import('./pages/tools/LoremIpsum'));
const RegexTester = lazy(() => import('./pages/tools/RegexTester'));
const CronExplainer = lazy(() => import('./pages/tools/CronExplainer'));
const TimestampConverter = lazy(() => import('./pages/tools/TimestampConverter'));
const ColorConverter = lazy(() => import('./pages/tools/ColorConverter'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

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
      <ScrollToTop />
      <Navbar />
      <main className="page-container">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/convert" element={<ConvertPage />} />
            <Route path="/format" element={<CodeFormatter />} />
            <Route path="/compare" element={<TextCompare />} />
            <Route path="/compile" element={<CodeCompiler />} />
            <Route path="/minify" element={<CodeMinifier />} />
            <Route path="/review" element={<CodeReviewer />} />
            <Route path="/optimize" element={<CodeOptimizer />} />
            <Route path="/qr-code" element={<QrGenerator />} />
            <Route path="/barcode" element={<BarcodeGenerator />} />
            <Route path="/folder-compare" element={<FolderCompare />} />
            <Route path="/data-convert" element={<DataConverter />} />
            <Route path="/json-to-ts" element={<JsonToTs />} />
            <Route path="/json-viewer" element={<JsonViewer />} />
            <Route path="/encode" element={<Encoder />} />
            <Route path="/jwt" element={<JwtDecoder />} />
            <Route path="/uuid" element={<UuidGenerator />} />
            <Route path="/hash" element={<HashGenerator />} />
            <Route path="/password" element={<PasswordGenerator />} />
            <Route path="/lorem" element={<LoremIpsum />} />
            <Route path="/regex" element={<RegexTester />} />
            <Route path="/cron" element={<CronExplainer />} />
            <Route path="/timestamp" element={<TimestampConverter />} />
            <Route path="/color" element={<ColorConverter />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
