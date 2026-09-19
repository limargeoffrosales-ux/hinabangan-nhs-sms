import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import i18n from './i18n';
import { initSentry, Sentry } from './sentry';
import './styles.css';

const LEGACY_MAP = { dark: 'midnight', light: 'light' };
const stored = localStorage.getItem('meridianed_theme') || 'midnight';
let theme = LEGACY_MAP[stored] || stored;
if (theme === 'auto') {
  theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'midnight';
}
document.documentElement.dataset.theme = theme;

i18n.isInitialized
  ? renderApp()
  : i18n.init().then(renderApp);

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

initSentry();

// Global error handlers for unhandled errors
window.addEventListener('error', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.reason);
  }
});

// Vite fires this when a chunk or modulepreload fails (typically a stale tab
// referencing hashed assets removed by a newer deploy). Reload once to pick up
// the current build instead of showing "Failed to fetch dynamically imported module".
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (typeof Sentry !== 'undefined') {
    Sentry.captureException(event.payload);
  }
  const KEY = 'meridianed_chunk_reload_at';
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* ignore */ }
  if (Date.now() - last > 10000) {
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    window.location.reload();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => { if (import.meta.env.DEV) console.warn('SW registration failed:', e); });
  });
}
