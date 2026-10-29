import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { useOnline } from '../lib/useOnline.ts';
import { usePendingCount } from '../lib/offline/hooks.ts';
import { setLang, type Lang } from '../i18n/index.ts';
import { TempPasswordBanner } from './TempPasswordBanner.tsx';

export function Shell({ children, title, back }: { children: ReactNode; title?: string; back?: string }) {
  const { t, i18n } = useTranslation();
  const { profile, orgName, signOut } = useAuth();
  const online = useOnline();
  const pending = usePendingCount(profile?.user_id);
  const lang = i18n.language as Lang;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        {back ? <Link to={back} className="grid size-11 place-items-center text-2xl" aria-label={t('back')}>←</Link> : null}
        <Link to="/" className="flex min-h-11 min-w-0 flex-1 items-center truncate font-bold text-brand-strong">{title ?? 'LossMap'}</Link>
        {pending > 0 && <Link to="/queue" className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn" data-testid="pending-badge">⬆ {pending}</Link>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${online ? 'bg-brand/15 text-brand-strong' : 'bg-warn/15 text-warn'}`} data-testid="online-badge">{online ? t('online') : t('offline')}</span>
        <button className="min-h-11 min-w-11 rounded-lg border border-line px-2 text-sm font-semibold" onClick={() => setLang(lang === 'te' ? 'en' : 'te')} aria-label={t('language')} data-testid="lang-toggle">{lang === 'te' ? 'EN' : 'తె'}</button>
      </header>
      <main className="flex-1 space-y-4 p-4"><TempPasswordBanner />{children}</main>
      {profile ? (
        <footer className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">{profile.name} · {t(`role_${profile.role}`)}{orgName ? ` · ${orgName}` : ''}</span>
          <Link to="/account" className="flex min-h-11 items-center whitespace-nowrap px-2 underline">{t('account')}</Link>
          <button className="min-h-11 whitespace-nowrap px-2 underline" onClick={() => { if (pending > 0 && !window.confirm(t('signOutPending', { n: pending }))) return; void signOut(); }}>{t('signOut')}</button>
        </footer>
      ) : null}
    </div>
  );
}
