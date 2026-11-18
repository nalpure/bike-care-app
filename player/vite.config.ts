// Vite config for the player. The content bundle is not compiled in: the app fetches
// ./bundle.json at start, so a changed bundle changes the app without touching player code.
// In dev it is served from build/bundle.json; the static build copies it next to index.html.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const repo = resolve(import.meta.dirname, '..');
const bundlePath = resolve(repo, 'build/bundle.json');

function contentBundle(): Plugin {
  return {
    name: 'content-bundle',
    configureServer(server) {
      server.middlewares.use('/bundle.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(bundlePath, 'utf8'));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'bundle.json', source: readFileSync(bundlePath, 'utf8') });
      // A test build is not for search engines.
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: 'User-agent: *\nDisallow: /\n' });
      // Netlify and Cloudflare Pages read _headers: no indexing, and a new bundle shows on reload.
      this.emitFile({ type: 'asset', fileName: '_headers', source: '/*\n  X-Robots-Tag: noindex, nofollow\n/bundle.json\n  Cache-Control: no-cache\n' });
    },
  };
}

export default defineConfig({
  root: resolve(repo, 'player'),
  base: './',
  plugins: [contentBundle()],
  server: { fs: { allow: [repo] }, host: true },
  // three.js alone is about 600 kB minified (150 kB gzipped); one chunk is fine for a test build.
  build: { outDir: resolve(repo, 'dist'), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 900 },
});
