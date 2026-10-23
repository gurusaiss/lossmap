import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import te from './te.json';

export type Lang = 'en' | 'te';
const stored = (() => { try { return localStorage.getItem('lossmap.lang'); } catch { return null; } })();
void i18n.use(initReactI18next).init({ resources: { en: { translation: en }, te: { translation: te } }, lng: stored === 'te' ? 'te' : 'en', fallbackLng: 'en', interpolation: { escapeValue: false } });
export function setLang(l: Lang) { try { localStorage.setItem('lossmap.lang', l); } catch { /* ignore */ } void i18n.changeLanguage(l); document.documentElement.lang = l; }
export default i18n;
