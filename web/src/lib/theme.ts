export type Theme = 'system' | 'light' | 'dark';
const KEY = 'lossmap.theme';
export const getTheme = (): Theme => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; } };
export function applyTheme(t: Theme) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* ignore */ }
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
export const nextTheme = (t: Theme): Theme => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system');
