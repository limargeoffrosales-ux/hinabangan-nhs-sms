import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const bundles = { en: () => import('./en.json'), fil: () => import('./fil.json') };

const initPromise = Promise.all([
  bundles.en(),
  bundles.fil(),
]).then(([enMod, filMod]) => {
  // i18next's .init() overloads get confused by the chained .use() calls above
  // under checkJs; the call shape is correct at runtime.
  const config = {
    resources: {
      en: { translation: enMod.default },
      fil: { translation: filMod.default },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // NB: the installed i18next-browser-languagedetector persists under
      // 'i18nextLng' — the `key` option was dropped in newer versions, so it
      // was removed here rather than silently ignored.
    },
  };
  return /** @type {Promise<void>} */ (/** @type {unknown} */ (i18n.use(LanguageDetector).use(initReactI18next).init(config)));
});

export const initI18n = () => initPromise;
export default i18n;
