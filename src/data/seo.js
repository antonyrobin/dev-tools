// Search-engine metadata for every route. Plain data with no imports so both the app
// (src/components/Seo.jsx updates <head> on navigation) and the build (vite-plugin-seo.js
// prerenders one HTML file per route, plus sitemap.xml and robots.txt) can read it.

export const SITE_URL = 'https://devtools.redexoans.com';
export const SITE_NAME = 'DevTools';

export const DEFAULT_SEO_PATH = '/';

export const SEO = {
  '/': {
    title: 'DevTools – Free Online Code Formatter, Minifier, Diff, Converter & QR Tools',
    heading: 'Free online developer tools',
    description: 'Free online developer tools: code formatter & beautifier, code minifier, JavaScript compiler, text compare, folder compare, document converter, QR code generator & scanner, JSON, Base64, JWT and more. Private, fast, works offline.',
    keywords: ['developer tools', 'online dev tools', 'free developer tools', 'code formatter', 'code beautifier', 'code minifier', 'code compiler', 'online compiler', 'text compare', 'diff checker', 'folder compare', 'document conversion', 'file converter', 'qr code generator', 'qr code scanner', 'barcode generator', 'barcode reader', 'json formatter', 'json to yaml', 'base64 encode decode', 'jwt decoder', 'uuid generator', 'hash generator', 'password generator', 'regex tester', 'cron expression', 'timestamp converter', 'color converter', 'open source'],
    priority: 1.0,
  },
  '/format': {
    title: 'Code Formatter & Beautifier – Format JSON, SQL, HTML, CSS, JavaScript Online',
    heading: 'Code Formatter & Beautifier',
    description: 'Free online code formatter and beautifier. Pretty print and fix JSON, JavaScript, TypeScript, HTML, CSS, SQL (10+ dialects), XML, YAML and Markdown with syntax highlighting. Handles large files.',
    keywords: ['code formatter', 'code beautifier', 'online code formatter', 'code prettifier', 'pretty print', 'json formatter', 'json beautifier', 'json pretty print', 'fix json', 'json validator', 'sql formatter', 'sql beautifier', 'html formatter', 'html beautifier', 'css formatter', 'css beautifier', 'javascript formatter', 'javascript beautifier', 'js beautifier', 'typescript formatter', 'xml formatter', 'yaml formatter', 'markdown formatter', 'prettier online'],
    priority: 0.9,
  },
  '/minify': {
    title: 'Code Minifier – Minify JavaScript, CSS & HTML Online',
    heading: 'Code Minifier',
    description: 'Free online code minifier. Minify and compress JavaScript, CSS and HTML for production, remove whitespace and comments, and see the exact size savings. Runs in your browser.',
    keywords: ['code minifier', 'minify code', 'javascript minifier', 'js minifier', 'minify javascript', 'css minifier', 'minify css', 'html minifier', 'minify html', 'code compressor', 'compress javascript', 'compress css', 'uglify js', 'online minifier'],
    priority: 0.9,
  },
  '/compile': {
    title: 'Online JavaScript Compiler – Run JS Code in Your Browser',
    heading: 'Online JavaScript Compiler & Runner',
    description: 'Free online JavaScript compiler and code runner. Write, run and test JS snippets instantly in your browser and inspect console output — no setup or install needed.',
    keywords: ['code compiler', 'online compiler', 'javascript compiler', 'online javascript compiler', 'js compiler', 'run javascript online', 'javascript runner', 'js playground', 'javascript playground', 'online code editor', 'code runner', 'javascript console online', 'test javascript online'],
    priority: 0.9,
  },
  '/optimize': {
    title: 'JavaScript Code Optimizer – Modernize & Refactor JS Online',
    heading: 'JavaScript Code Optimizer',
    description: 'Free online JavaScript code optimizer. Apply automated modernisation refactors — var to const, index loops to forEach, stray console.log removal — to clean up legacy JS.',
    keywords: ['code optimizer', 'javascript optimizer', 'js optimizer', 'optimize javascript', 'refactor javascript', 'modernize javascript', 'es6 converter', 'code cleanup', 'javascript refactoring tool'],
    priority: 0.7,
  },
  '/review': {
    title: 'Code Reviewer – Free Online JavaScript Code Review & Linter',
    heading: 'Code Reviewer',
    description: 'Free online code reviewer that flags common JavaScript bugs, anti-patterns and code smells instantly. A quick, private code review and lint check in your browser.',
    keywords: ['code reviewer', 'code review tool', 'online code review', 'javascript linter', 'js lint online', 'code checker', 'code quality', 'find bugs in code', 'static code analysis'],
    priority: 0.7,
  },
  '/compare': {
    title: 'Text Compare – Online Diff Checker to Compare Text & Code',
    heading: 'Text Compare & Diff Checker',
    description: 'Free online text compare and diff checker. Compare two texts, code or files side by side or unified, with inline word-level changes and quick navigation. Fast on large files.',
    keywords: ['text compare', 'compare text', 'diff checker', 'online diff', 'text diff', 'diff tool', 'compare two texts', 'compare files online', 'code compare', 'code diff', 'difference checker', 'side by side diff', 'compare documents', 'json compare', 'file compare'],
    priority: 0.9,
  },
  '/folder-compare': {
    title: 'Folder Compare – Compare Folders, Directories & ZIP Files Online',
    heading: 'Folder & ZIP Compare',
    description: 'Free online folder compare tool. Compare two folders, directories, sets of files or ZIP archives and see which files were added, removed or changed — with file-by-file diffs.',
    keywords: ['folder compare', 'compare folders', 'directory compare', 'compare directories', 'folder diff', 'directory diff', 'zip compare', 'compare zip files', 'file comparison tool', 'compare two folders online', 'folder comparison'],
    priority: 0.9,
  },
  '/convert': {
    title: 'Document Converter – Convert Word, PDF, Excel, HTML & Markdown Online',
    heading: 'Document & File Converter',
    description: 'Free online document converter. Convert Word (DOCX), PDF, Excel (XLSX), CSV, Markdown, HTML, JSON and images between formats, with a built-in rich text editor. Files never leave your device.',
    keywords: ['document conversion', 'document converter', 'file converter', 'online file converter', 'word to pdf', 'docx to pdf', 'pdf to word', 'pdf to text', 'html to pdf', 'docx to html', 'markdown to html', 'html to markdown', 'excel to csv', 'csv to excel', 'excel to json', 'image converter', 'png to jpg', 'convert documents online'],
    priority: 0.9,
  },
  '/data-convert': {
    title: 'JSON, YAML, XML & CSV Converter Online',
    heading: 'JSON / YAML / XML / CSV Converter',
    description: 'Free online data converter. Convert JSON to YAML, YAML to JSON, JSON to XML, XML to JSON, JSON to CSV and CSV to JSON instantly as you type.',
    keywords: ['data converter', 'json to yaml', 'yaml to json', 'json to xml', 'xml to json', 'json to csv', 'csv to json', 'xml to yaml', 'yaml to xml', 'csv to xml', 'json converter', 'yaml converter'],
    priority: 0.8,
  },
  '/json-to-ts': {
    title: 'JSON to TypeScript – Generate Interfaces & Types Online',
    heading: 'JSON to TypeScript',
    description: 'Free online JSON to TypeScript converter. Generate TypeScript interfaces or type aliases from JSON samples, with nested types and optional fields.',
    keywords: ['json to typescript', 'json to ts', 'json to interface', 'typescript interface generator', 'json to type', 'generate typescript types', 'json schema to typescript'],
    priority: 0.8,
  },
  '/json-viewer': {
    title: 'JSON Viewer – Online JSON Tree Viewer & JSONPath Tester',
    heading: 'JSON Tree Viewer',
    description: 'Free online JSON viewer. Explore JSON as a collapsible tree, copy any node path and run JSONPath queries against your data.',
    keywords: ['json viewer', 'json tree viewer', 'online json viewer', 'json explorer', 'jsonpath tester', 'jsonpath online', 'view json', 'json parser'],
    priority: 0.8,
  },
  '/encode': {
    title: 'Base64 Encode & Decode, URL Encoder and HTML Entities Online',
    heading: 'Encoder / Decoder',
    description: 'Free online encoder and decoder. Base64 encode and decode, URL encode and decode, and HTML entity encoding — Unicode-safe and instant.',
    keywords: ['base64 encode', 'base64 decode', 'base64 encoder', 'base64 decoder', 'url encode', 'url decode', 'url encoder', 'html entities', 'html encode', 'html decode', 'encoder decoder online'],
    priority: 0.8,
  },
  '/jwt': {
    title: 'JWT Decoder – Decode & Verify JSON Web Tokens Online',
    heading: 'JWT Decoder',
    description: 'Free online JWT decoder. Decode JSON Web Tokens, read header, payload claims and expiry, and verify HMAC or RSA signatures locally in your browser.',
    keywords: ['jwt decoder', 'decode jwt', 'jwt parser', 'jwt verify', 'json web token decoder', 'jwt debugger', 'jwt online', 'jwt signature verify'],
    priority: 0.8,
  },
  '/uuid': {
    title: 'UUID Generator – Generate UUID v4 & v7 Online in Bulk',
    heading: 'UUID Generator',
    description: 'Free online UUID / GUID generator. Generate random v4 and time-ordered v7 UUIDs in bulk, and inspect or validate existing UUIDs.',
    keywords: ['uuid generator', 'guid generator', 'generate uuid', 'uuid v4', 'uuid v7', 'random uuid', 'bulk uuid generator', 'uuid validator'],
    priority: 0.8,
  },
  '/hash': {
    title: 'Hash Generator – MD5, SHA-1, SHA-256, SHA-512 & HMAC Online',
    heading: 'Hash Generator',
    description: 'Free online hash generator. Calculate MD5, SHA-1, SHA-256, SHA-384 and SHA-512 checksums for text or files, generate HMAC and compare hashes.',
    keywords: ['hash generator', 'md5 generator', 'sha256 generator', 'sha1 hash', 'sha512 hash', 'hmac generator', 'checksum calculator', 'file hash', 'md5 checksum', 'sha256 online'],
    priority: 0.8,
  },
  '/password': {
    title: 'Strong Password Generator – Secure Random Passwords Online',
    heading: 'Password Generator',
    description: 'Free online password generator. Create strong, secure random passwords with the browser’s cryptographic generator and see a strength estimate.',
    keywords: ['password generator', 'strong password generator', 'random password generator', 'secure password', 'generate password', 'password strength checker'],
    priority: 0.8,
  },
  '/lorem': {
    title: 'Lorem Ipsum Generator – Placeholder Text Online',
    heading: 'Lorem Ipsum Generator',
    description: 'Free online lorem ipsum generator. Create placeholder paragraphs, sentences or words as plain text or HTML for mockups and designs.',
    keywords: ['lorem ipsum generator', 'lorem ipsum', 'placeholder text', 'dummy text generator', 'filler text'],
    priority: 0.6,
  },
  '/qr-code': {
    title: 'QR Code Generator – Create Free Custom QR Codes & Download PNG',
    heading: 'QR Code Generator',
    description: 'Free online QR code generator. Create custom QR codes for URLs, text, Wi-Fi and more, choose colours and size, and download as PNG. No sign-up, no watermark.',
    keywords: ['qr code generator', 'free qr code generator', 'create qr code', 'qr code maker', 'custom qr code', 'qr code for url', 'qr code png', 'generate qr code online'],
    priority: 0.9,
  },
  '/barcode': {
    title: 'Barcode Generator – Free CODE128 Barcodes Online, Bulk & Print',
    heading: 'Barcode Generator',
    description: 'Free online barcode generator. Create and print sequential CODE128 barcodes in bulk for inventory, labels and products.',
    keywords: ['barcode generator', 'free barcode generator', 'code128 barcode', 'barcode maker', 'bulk barcode generator', 'print barcodes', 'inventory barcode', 'barcode labels'],
    priority: 0.8,
  },
  '/scanner': {
    title: 'QR Code Scanner & Barcode Reader Online – Scan from Image or Camera',
    heading: 'QR Code Scanner & Barcode Reader',
    description: 'Free online QR code scanner and barcode reader. Scan QR codes and barcodes from images, screenshots or your camera — decoded locally in your browser.',
    keywords: ['qr code scanner', 'qr code reader', 'scan qr code online', 'qr scanner', 'barcode scanner', 'barcode reader', 'scan barcode online', 'read qr code from image', 'qr code decoder'],
    priority: 0.9,
  },
  '/regex': {
    title: 'Regex Tester – Test Regular Expressions Online',
    heading: 'Regex Tester',
    description: 'Free online regex tester. Test JavaScript regular expressions with live match highlighting, capture groups and replace preview.',
    keywords: ['regex tester', 'regex online', 'regular expression tester', 'regex checker', 'test regex', 'javascript regex', 'regex replace'],
    priority: 0.8,
  },
  '/cron': {
    title: 'Cron Expression Explainer – Crontab to Plain English & Next Runs',
    heading: 'Cron Expression Explainer',
    description: 'Free online cron expression explainer. Translate crontab schedules into plain English and preview the next run times.',
    keywords: ['cron expression', 'cron explainer', 'crontab guru', 'cron parser', 'cron schedule', 'crontab to english', 'cron next run'],
    priority: 0.7,
  },
  '/timestamp': {
    title: 'Unix Timestamp Converter – Epoch to Date & Time Online',
    heading: 'Timestamp Converter',
    description: 'Free online Unix timestamp converter. Convert epoch seconds or milliseconds to human-readable dates and back, across formats and time zones.',
    keywords: ['timestamp converter', 'unix timestamp', 'epoch converter', 'epoch to date', 'date to timestamp', 'unix time converter', 'milliseconds to date'],
    priority: 0.7,
  },
  '/color': {
    title: 'Color Converter – HEX to RGB, HSL, CMYK & OKLCH with Contrast Checker',
    heading: 'Color Converter',
    description: 'Free online color converter. Convert HEX, RGB, HSL, HWB, CMYK and OKLCH, check WCAG contrast and generate shades and tints.',
    keywords: ['color converter', 'hex to rgb', 'rgb to hex', 'hex to hsl', 'color picker', 'cmyk converter', 'oklch', 'contrast checker', 'color shades'],
    priority: 0.7,
  },
  '/privacy': {
    title: 'Privacy Policy',
    heading: 'Privacy Policy',
    description: 'How DevTools handles your data: tools run entirely in your browser and your files and code are never uploaded.',
    keywords: ['privacy policy', 'devtools'],
    priority: 0.2,
  },
  '/terms': {
    title: 'Terms of Service',
    heading: 'Terms of Service',
    description: 'Terms of service for using the free, open source DevTools website.',
    keywords: ['terms of service', 'devtools'],
    priority: 0.2,
  },
};

export const getSeo = (path) => SEO[path] || SEO[DEFAULT_SEO_PATH];

export const pageTitle = (seo) =>
  seo === SEO[DEFAULT_SEO_PATH] ? seo.title : `${seo.title} | ${SITE_NAME}`;

export const canonicalUrl = (path) => (path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`);
