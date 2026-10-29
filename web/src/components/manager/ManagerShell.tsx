import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth.tsx';
import { setLang, type Lang } from '../../i18n/index.ts';
import { applyTheme, getTheme, nextTheme, type Theme } from '../../lib/theme.ts';
import { usePendingCount } from '../../lib/offline/hooks.ts';
import { TempPasswordBanner } from '../TempPasswordBanner.tsx';
import { ArrowUpIcon } from '../Icon.tsx';

const THEME_LABEL: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };
export function ManagerShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { profile, orgName, signOut } = useAuth();
  const [theme, setTheme] = useState<Theme>(getTheme());
  const pending = usePendingCount(profile?.user_id);
  const lang = i18n.language as Lang;
  const link = ({ isActive }: { isActive: boolean }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-brand/15 text-brand-strong' : 'text-muted'}`;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
          <Link to="/m" className="font-extrabold text-brand-strong">LossMap</Link>
          <span className="hidden truncate text-sm text-muted sm:inline">{orgName}</span><span className="flex-1" />
          {pending > 0 && <Link to="/queue" className="flex items-center gap-0.5 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn"><ArrowUpIcon className="size-3.5" /> {pending}</Link>}
          <Link to="/?field=1" className="hidden min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold sm:inline-flex">{t('fieldApp')}</Link>
          <button className="min-h-10 min-w-10 rounded-lg border border-line px-2 text-sm font-semibold" aria-label="Theme" data-testid="theme-toggle" onClick={() => { const n = nextTheme(theme); applyTheme(n); setTheme(n); }}>{THEME_LABEL[theme]}</button>
          <button className="min-h-10 rounded-lg border border-line px-2 text-sm font-semibold" aria-label={t('language')} onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{lang === 'te' ? 'EN' : 'తె'}</button>
          <Link to="/account" className="inline-flex min-h-10 items-center px-2 text-sm text-muted underline">{t('account')}</Link>
          <button className="min-h-10 px-2 text-sm text-muted underline" onClick={() => void signOut()}>{t('signOut')}</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Dashboard">
          <NavLink end to="/m" className={link}>{t('mgr_overview')}</NavLink><NavLink to="/m/lots" className={link}>{t('mgr_lots')}</NavLink>
          <NavLink to="/m/alerts" className={link}>{t('mgr_alerts')}</NavLink><NavLink to="/m/settings" className={link}>{t('mgr_settings')}</NavLink>
          <Link to="/?field=1" className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted sm:hidden">{t('fieldApp')}</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4">{profile?.role === 'manager' ? <><TempPasswordBanner />{children}</> : null}</main>
    </div>
  );
}
export const SimulatedBadge = () => { const { t } = useTranslation(); return <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn" data-testid="simulated-badge">{t('simulatedBanner')}</span>; };
