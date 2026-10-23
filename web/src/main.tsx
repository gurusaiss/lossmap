import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/index.ts';
import { applyTheme, getTheme } from './lib/theme.ts';
import App from './App.tsx';

applyTheme(getTheme());
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
