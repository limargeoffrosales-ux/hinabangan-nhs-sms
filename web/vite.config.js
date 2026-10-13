import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import fs from 'fs';
import path from 'path';

function getRelease() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
  let sha = 'dev';
  try {
    sha = require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {}
  return `${pkg.version}-${sha}`;
}

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: getRelease(),
      deploy: {
        env: process.env.NODE_ENV || 'development',
      },
      sourcemaps: {
        assets: ['./dist/**/*.js', './dist/**/*.map'],
        deleteAfterUpload: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 550,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Function form, not the object form. The object form produced an
        // essentially empty `vendor` chunk (0.40 kB) because react/react-dom
        // were claimed elsewhere, leaving 330 kB of React inside index.js.
        //
        // Only React is pulled out. Routing every third-party module into
        // `vendor` was tried and made first load WORSE (~169 -> ~276 kB
        // brotli): it hoisted dependencies that were previously inside lazily
        // loaded page chunks into one chunk the entry point always fetches.
        //
        // Isolating React still buys repeat-visit caching: chunks are
        // content-hashed and immutable, so a routine app change re-downloads
        // index-*.js only and vendor-*.js stays in the browser cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler|react-is|object-assign)[\\/]/.test(id)) return 'vendor';
          if (/node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'router';
          if (/node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons';
          if (/node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|html-parse-stringify)[\\/]/.test(id)) return 'i18n';
          // Everything else keeps the default placement, so page-level lazy
          // chunks stay lazy.
          return undefined;
        },
      },
    },
  },
});
