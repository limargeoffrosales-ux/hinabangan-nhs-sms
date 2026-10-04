import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import i18n, { initI18n } from './i18n';
import { initSentry, Sentry } from './sentry';
import ThemeProvider from './design-system/theme/ThemeProvider';
import './styles.css';
import './design-system/design-system.css';

const LEGACY_MAP = { dark: 'midnight', light: 'light' };
// Unguarded localStorage access throws SecurityError in Safari private mode
// and hardened profiles, which would take down the whole bundle before React
// ever mounted.
let stored = 'midnight';
try { stored = localStorage.getItem('meridianed_theme') || 'midnight'; } catch { /* storage unavailable */ }
let theme = LEGACY_MAP[stored] || stored;
if (theme === 'auto') {
  theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'midnight';
}
document.documentElement.dataset.theme = theme;

// Await the module's own init promise. Calling i18n.init() here started a SECOND
// init with no resources and no LanguageDetector: it flipped isInitialized true
// early (so the app rendered before the bundles loaded, flashing raw keys like
// "nav.dashboard") and then raced/overwrote the detector's language choice.
// initI18n() resolves only once the real config is applied.
initI18n().then(renderApp, (err) => {
  console.error('i18n init failed', err);
  renderApp();
});

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
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
