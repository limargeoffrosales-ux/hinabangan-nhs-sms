import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const bundles = { en: () => import('./en.json'), fil: () => import('./fil.json') };

const initPromise = Promise.all([
  bundles.en(),
  bundles.fil(),
]).then(([enMod, filMod]) => {
  return i18n.use(LanguageDetector).use(initReactI18next).init({
    resources: {
      en: { translation: enMod.default },
      fil: { translation: filMod.default },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      key: 'meridianed_lang',
    },
  });
});

export const initI18n = () => initPromise;
export default i18n;
