import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ha from './ha.json';

export const SUPPORTED_LOCALES = ['en', 'ha'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ha: 'Hausa',
};

export const LOCALE_STORAGE_KEY = 'marketplace_vendor_locale';

const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);

/** Prefer the account's saved choice, then the browser language, then English. */
const detectLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
    const nav = navigator.language?.slice(0, 2).toLowerCase();
    if (isLocale(nav)) return nav;
  } catch {
    // localStorage unavailable (private mode) - fall through.
  }
  return 'en';
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ha: { translation: ha },
  },
  lng: detectLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const setLocale = (locale: Locale) => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  i18n.changeLanguage(locale);
};

export default i18n;
