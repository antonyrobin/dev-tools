import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// Emits /sw.js with the list of every built file so the whole app works offline.
// Kept out of vite.config.js: `wrangler deploy` parses that file with esprima (ES2017 only)
// to add the Cloudflare plugin, and it fails on newer syntax such as import.meta.
export default function offlineServiceWorker() {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      // wrangler.json is emitted by @cloudflare/vite-plugin for deployment, not served to browsers
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'wrangler.json')
      const precache = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons.svg', ...files.map((f) => `/${f}`)]
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8')
        .replace('__SW_VERSION__', version)
        .replace('const PRECACHE = __SW_PRECACHE__;', `const PRECACHE = ${JSON.stringify([...new Set(precache)])};`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}
