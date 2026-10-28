import { SEO, SITE_URL, SITE_NAME, pageTitle, canonicalUrl } from './src/data/seo.js'

// Search-engine support for the single-page app, driven by src/data/seo.js:
// - fills the <!--app-seo--> and <!--app-fallback--> placeholders in index.html (dev and build)
// - emits one prerendered HTML file per route (format.html, compare.html, ...) whose title,
//   meta tags, structured data and crawlable content match that page; Cloudflare serves
//   /format from format.html, other hosts fall back to the SPA shell as before
// - emits sitemap.xml and robots.txt
// Kept out of vite.config.js for the same reason as vite-plugin-offline-sw.js.

const SECTIONS = {
  seo: ['<!--seo:start-->', '<!--seo:end-->'],
  fallback: ['<!--seo-fallback:start-->', '<!--seo-fallback:end-->'],
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

const toolPaths = () => Object.keys(SEO).filter((p) => p !== '/' && SEO[p].priority > 0.5)

const structuredData = (path) => {
  const seo = SEO[path]
  const url = canonicalUrl(path)
  if (path === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url,
        description: seo.description,
        inLanguage: 'en',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Free online developer tools',
        itemListElement: toolPaths().map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: SEO[p].heading,
          url: canonicalUrl(p),
        })),
      },
    ]
  }
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: seo.heading,
      url,
      description: seo.description,
      keywords: seo.keywords.join(', '),
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: canonicalUrl('/') },
        { '@type': 'ListItem', position: 2, name: seo.heading, item: url },
      ],
    },
  ]
}

const renderHead = (path) => {
  const seo = SEO[path]
  const title = escapeHtml(pageTitle(seo))
  const description = escapeHtml(seo.description)
  const url = canonicalUrl(path)
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="en_US" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...structuredData(path).map(jsonLd),
  ].join('\n    ')
}

// Shown until React mounts (createRoot replaces it): the page heading, its description and
// links to every tool, so crawlers that skip JavaScript still find content and internal links
const renderFallback = (path) => {
  const seo = SEO[path]
  const links = toolPaths()
    .filter((p) => p !== path)
    .map((p) => `<li><a href="${p}">${escapeHtml(SEO[p].heading)}</a></li>`)
    .join('')
  return `<div class="seo-fallback"><h1>${escapeHtml(seo.heading)}</h1><p>${escapeHtml(seo.description)}</p>` +
    `<nav aria-label="Developer tools"><ul>${path === '/' ? '' : '<li><a href="/">All developer tools</a></li>'}${links}</ul></nav></div>`
}

const wrap = (key, content) => `${SECTIONS[key][0]}\n    ${content}\n    ${SECTIONS[key][1]}`

const replaceSection = (html, key, content) => {
  const [start, end] = SECTIONS[key]
  const from = html.indexOf(start)
  const to = html.indexOf(end)
  if (from === -1 || to === -1) throw new Error(`[seo] index.html is missing the ${key} section`)
  return html.slice(0, from) + wrap(key, content) + html.slice(to + end.length)
}

const sitemap = () => {
  const lastmod = new Date().toISOString().slice(0, 10)
  const urls = Object.keys(SEO).map((p) =>
    `  <url><loc>${canonicalUrl(p)}</loc><lastmod>${lastmod}</lastmod><priority>${SEO[p].priority.toFixed(1)}</priority></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`

export default function seo() {
  return {
    name: 'seo',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace('<!--app-seo-->', wrap('seo', renderHead('/')))
        .replace('<!--app-fallback-->', wrap('fallback', renderFallback('/')))
    },
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index) return
      const shell = String(index.source)
      for (const path of Object.keys(SEO)) {
        if (path === '/') continue
        const html = replaceSection(replaceSection(shell, 'seo', renderHead(path)), 'fallback', renderFallback(path))
        this.emitFile({ type: 'asset', fileName: `${path.slice(1)}.html`, source: html })
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() })
    },
  }
}
