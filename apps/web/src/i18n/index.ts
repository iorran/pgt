import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './pt-BR.json';
import en from './en.json';

// Remember the user's language across reloads; storage can throw (private mode, blocked site data).
const STORAGE_KEY = 'pgt-lang';
const saved = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
  },
  lng: saved === 'en' ? 'en' : 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Non-persistent session: the choice still applies until reload.
  }
});

export default i18n;
