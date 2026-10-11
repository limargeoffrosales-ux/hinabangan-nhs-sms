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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          icons: ['lucide-react'],
          charts: ['recharts'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
});
