import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted so English and Telugu render identically on every device and offline (no system-font gamble); each script's
// woff2 is fetched lazily by unicode-range, so an English-only session never pays for the Telugu glyphs and vice versa.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/noto-sans-telugu/telugu-400.css';
import '@fontsource/noto-sans-telugu/telugu-700.css';
import './index.css';
import './i18n/index.ts';
import { applyTheme, getTheme } from './lib/theme.ts';
import App from './App.tsx';

applyTheme(getTheme());
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
