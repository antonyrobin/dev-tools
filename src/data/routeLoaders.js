// Dynamic imports for every code-split page, keyed by route path.
// App.jsx builds its lazy routes from these, and links call prefetchRoute on hover
// so the chunk is usually already downloaded by the time the user clicks.
export const ROUTE_LOADERS = {
  '/convert': () => import('../pages/ConvertPage'),
  '/format': () => import('../pages/CodeFormatter'),
  '/compare': () => import('../pages/TextCompare'),
  '/compile': () => import('../pages/CodeCompiler'),
  '/minify': () => import('../pages/CodeMinifier'),
  '/review': () => import('../pages/CodeReviewer'),
  '/optimize': () => import('../pages/CodeOptimizer'),
  '/qr-code': () => import('../pages/QrGenerator'),
  '/barcode': () => import('../pages/BarcodeGenerator'),
  '/scanner': () => import('../pages/tools/CodeScanner'),
  '/folder-compare': () => import('../pages/tools/FolderCompare'),
  '/data-convert': () => import('../pages/tools/DataConverter'),
  '/json-to-ts': () => import('../pages/tools/JsonToTs'),
  '/json-viewer': () => import('../pages/tools/JsonViewer'),
  '/encode': () => import('../pages/tools/Encoder'),
  '/jwt': () => import('../pages/tools/JwtDecoder'),
  '/uuid': () => import('../pages/tools/UuidGenerator'),
  '/hash': () => import('../pages/tools/HashGenerator'),
  '/password': () => import('../pages/tools/PasswordGenerator'),
  '/lorem': () => import('../pages/tools/LoremIpsum'),
  '/regex': () => import('../pages/tools/RegexTester'),
  '/cron': () => import('../pages/tools/CronExplainer'),
  '/timestamp': () => import('../pages/tools/TimestampConverter'),
  '/color': () => import('../pages/tools/ColorConverter'),
  '/privacy': () => import('../pages/Privacy'),
  '/terms': () => import('../pages/Terms'),
};

const prefetched = new Set();

export const prefetchRoute = (path) => {
  const load = ROUTE_LOADERS[path];
  if (!load || prefetched.has(path)) return;
  prefetched.add(path);
  load().catch(() => prefetched.delete(path));
};
