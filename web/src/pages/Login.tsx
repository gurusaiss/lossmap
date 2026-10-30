import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { isConfigured } from '../lib/supabase.ts';
import { setLang, type Lang } from '../i18n/index.ts';

const DEMO = [{ role: 'role_manager', email: 'manager@demo.lossmap.app' }, { role: 'role_field_agent', email: 'agent@demo.lossmap.app' }, { role: 'role_factory_receiver', email: 'receiver@demo.lossmap.app' }];
const DEMO_PASSWORD = 'LossMap-Demo-2026';
// Fixed public_token the demo seed always assigns to lot T-1043 (see migration 0005), so this link always works without logging in.
const DEMO_FARMER_TOKEN = '7f3a9c2e1b6d4850a2f9e7c3b1d6485029f3e7c1b9d6485a2f9e7c3b1d64850';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { signIn, signedIn, profile, profileMissing } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (signedIn && !profile && profileMissing) return <Navigate to="/" replace />; // the blocked screen explains why
  if (signedIn && profile) return <Navigate to={profile.role === 'manager' ? '/m' : '/'} replace />;
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); const err = await signIn(email, password); setBusy(false); if (err) setError(t('loginFailed')); }
  const lang = i18n.language as Lang;
  return (
    <div className="animate-in mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <div className="flex items-start justify-between"><div><h1 className="text-figure text-4xl font-extrabold">LossMap</h1><p className="text-muted">{t('tagline')}</p></div>
        <button className="min-h-11 min-w-11 rounded-lg border border-line px-2 text-sm font-semibold" aria-label={t('language')} onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{lang === 'te' ? 'EN' : 'తె'}</button></div>
      {!isConfigured && <p role="alert" className="card text-sm text-warn">{t('notConfigured')}</p>}
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block"><span className="label">{t('email')}</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="block"><span className="label">{t('password')}</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <button className="btn btn-primary text-lg" disabled={busy} data-testid="login-submit">{busy ? t('signingIn') : t('signIn')}</button>
      </form>
      <section className="card space-y-2" aria-label={t('demoLogins')}>
        <h2 className="text-sm font-bold">{t('demoLogins')}</h2>
        {DEMO.map((d) => (
          <div key={d.email} className="flex items-center justify-between gap-2 rounded-lg p-1.5 text-sm transition-colors hover:bg-line/40"><span className="min-w-0"><b>{t(d.role)}</b><br /><span className="break-all text-muted">{d.email}</span></span>
            <button type="button" className="rounded-lg border border-line px-3 py-2 font-semibold transition-colors hover:border-brand hover:text-brand-strong" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); }}>{t('useThis')}</button></div>
        ))}
        <p className="text-xs text-muted">{t('demoPasswordShown', { password: DEMO_PASSWORD })}</p>
      </section>
      <Link to={`/r/${DEMO_FARMER_TOKEN}`} className="btn" data-testid="demo-farmer-report">{t('viewFarmerDemo')}</Link>
    </div>
  );
}
