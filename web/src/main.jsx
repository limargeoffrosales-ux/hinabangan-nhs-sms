import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import './styles.css';

const LEGACY_MAP = { dark: 'midnight', light: 'light' };
const stored = localStorage.getItem('meridianed_theme') || 'midnight';
let theme = LEGACY_MAP[stored] || stored;
if (theme === 'auto') {
  theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'midnight';
}
document.documentElement.dataset.theme = theme;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
