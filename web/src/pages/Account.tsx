import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateNewPassword } from '@lossmap/core';
import { useAuth } from '../lib/auth.tsx';
import { supabase } from '../lib/supabase.ts';
import { Shell } from '../components/Shell.tsx';
import { ManagerShell } from '../components/manager/ManagerShell.tsx';

function AccountBody() {
  const { t } = useTranslation();
  const { profile, session, orgName, orgIsDemo } = useAuth();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [msg, setMsg] = useState<{ key: string; ok: boolean } | null>(null); const [busy, setBusy] = useState(false);
  async function change() {
    if (pw !== again) return setMsg({ key: 'passwordMismatch', ok: false });
    const bad = validateNewPassword(pw);
    if (bad) return setMsg({ key: bad === 'tooShort' ? 'passwordTooShort' : 'passwordTooSimple', ok: false });
    if (!navigator.onLine) return setMsg({ key: 'passwordOffline', ok: false });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, data: { temp_password: false } }); // clears the reminder
    setBusy(false);
    if (error) return setMsg({ key: /different|same/i.test(error.message) ? 'passwordSame' : 'error', ok: false });
    setPw(''); setAgain(''); setMsg({ key: 'passwordChanged', ok: true });
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold">{t('account')}</h1>
      <section className="card space-y-1 text-sm" data-testid="account-details">
        <div><b>{profile?.name}</b> · {profile ? t(`role_${profile.role}`) : ''}</div>
        {orgName && <div className="text-muted">{orgName}</div>}
        {session?.user.email && <div className="text-muted" data-testid="account-email">{session.user.email}</div>}
      </section>
      {orgIsDemo ? <p className="card text-sm text-muted" data-testid="demo-password-note">{t('demoPasswordNote')}</p> : (
        <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); void change(); }} data-testid="password-form">
          <h2 className="text-lg font-bold">{t('changePassword')}</h2>
          <label className="block"><span className="label">{t('newPassword')}</span><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="new-password" /></label>
          <label className="block"><span className="label">{t('repeatPassword')}</span><input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} data-testid="repeat-password" /></label>
          <p className="text-xs text-muted">{t('passwordRules')}</p>
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-brand-strong' : 'text-danger'} data-testid="password-msg">{t(msg.key)}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy} data-testid="password-save">{t('changePassword')}</button>
        </form>
      )}
    </>
  );
}
export default function Account() {
  const { profile } = useAuth();
  return profile?.role === 'manager' ? <ManagerShell><AccountBody /></ManagerShell> : <Shell back="/"><AccountBody /></Shell>;
}
