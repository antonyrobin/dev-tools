import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import offlineServiceWorker from './vite-plugin-offline-sw.js'
import seo from './vite-plugin-seo.js'

// Keep this file to plain ES2017 syntax: `wrangler deploy` parses it with esprima
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineServiceWorker(), seo()],
})
