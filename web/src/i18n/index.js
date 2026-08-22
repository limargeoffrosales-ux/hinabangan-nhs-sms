import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const bundles = { en: () => import('./en.json'), fil: () => import('./fil.json') };

function detectLang() {
  try { return localStorage.getItem('meridianed_lang') || (navigator.language || 'en').slice(0, 2); } catch { return 'en'; }
}

const lng = detectLang();
const loader = bundles[lng] || bundles.en;

loader().then(mod => {
  i18n.use(LanguageDetector).use(initReactI18next).init({
    resources: { [lng]: { translation: mod.default } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], key: 'meridianed_lang' },
  });
});

export default i18n;
