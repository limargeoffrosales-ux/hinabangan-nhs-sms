import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import i18n from './i18n';
import { initSentry } from './sentry';
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => { if (import.meta.env.DEV) console.warn('SW registration failed:', e); });
  });
}
