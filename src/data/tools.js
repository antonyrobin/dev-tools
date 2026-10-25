import { FileText, FileJson, GitCompare, Zap, Cpu, Code, Search, QrCode, AlignJustify } from 'lucide-react';

// Single source of truth for tool navigation (navbar, home grid, footer)
export const TOOLS = [
  {
    path: '/format',
    name: 'Format',
    title: 'Code Formatter',
    description: 'Beautify JSON, JavaScript, HTML, CSS, SQL, YAML and more with syntax highlighting, folding and fast find.',
    icon: FileJson,
    color: '#6366f1',
    category: 'code',
  },
  {
    path: '/compare',
    name: 'Compare',
    title: 'Text Compare',
    description: 'Side-by-side or unified diff with inline word changes, change navigation and find.',
    icon: GitCompare,
    color: '#8b5cf6',
    category: 'code',
  },
  {
    path: '/convert',
    name: 'Convert',
    title: 'Document Converter',
    description: 'Convert Word, PDF, Excel, CSV, Markdown, HTML, JSON and images — with a rich text editor.',
    icon: FileText,
    color: '#3b82f6',
    category: 'docs',
  },
  {
    path: '/minify',
    name: 'Minify',
    title: 'Code Minifier',
    description: 'Compress HTML, CSS or JavaScript for production and see the size savings.',
    icon: Zap,
    color: '#ec4899',
    category: 'code',
  },
  {
    path: '/compile',
    name: 'Compile',
    title: 'JS Runner',
    description: 'Run JavaScript snippets in the browser and inspect console output.',
    icon: Cpu,
    color: '#10b981',
    category: 'code',
  },
  {
    path: '/optimize',
    name: 'Optimize',
    title: 'Code Optimizer',
    description: 'Apply automated modernisation refactors to JavaScript code.',
    icon: Code,
    color: '#f59e0b',
    category: 'code',
  },
  {
    path: '/review',
    name: 'Review',
    title: 'Code Reviewer',
    description: 'Heuristic review that flags common bugs and anti-patterns.',
    icon: Search,
    color: '#06b6d4',
    category: 'code',
  },
  {
    path: '/qr-code',
    name: 'QR Code',
    title: 'QR Generator',
    description: 'Create customised QR codes and download them as PNG.',
    icon: QrCode,
    color: '#3b82f6',
    category: 'generate',
  },
  {
    path: '/barcode',
    name: 'Barcode',
    title: 'Barcode Generator',
    description: 'Generate and print sequential CODE128 barcodes for inventory.',
    icon: AlignJustify,
    color: '#a855f7',
    category: 'generate',
  },
];

// Tools shown directly in the desktop navbar; the rest live under "More"
export const PRIMARY_TOOL_PATHS = ['/format', '/compare', '/convert', '/minify'];
