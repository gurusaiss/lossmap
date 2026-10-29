import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STAFF_ROLES, validateStaffInput, type StaffRole } from '@lossmap/core';
import { useAuth } from '../../lib/auth.tsx';
import { addStaff, listTeam, resetStaffPassword, setStaffActive, staffErrorKey, type StaffResult, type TeamMember } from '../../lib/staff.ts';

interface Credential { name: string; email: string | null; password: string; created: boolean }
const blank = { name: '', email: '', role: 'field_agent' as StaffRole, phone: '' };

export function TeamSection() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [team, setTeam] = useState<TeamMember[] | null>(null); const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState(blank); const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null); const [cred, setCred] = useState<Credential | null>(null); const [copied, setCopied] = useState(false);
  const reload = useCallback(() => listTeam().then((x) => { setTeam(x); setLoadFailed(false); }).catch(() => setLoadFailed(true)), []);
  useEffect(() => { void reload(); }, [reload]);

  async function run<T>(job: () => Promise<StaffResult<T>>, onOk: (r: StaffResult<T> & { ok: true }) => void) {
    setBusy(true); setErrKey(null); const r = await job(); setBusy(false);
    if (r.ok) { onOk(r); void reload(); } else setErrKey(staffErrorKey(r.code));
  }
  const show = (c: Credential) => { setCred(c); setCopied(false); };
  async function add() {
    if (!validateStaffInput(form).ok) return setErrKey(staffErrorKey('invalid'));
    await run(() => addStaff(form), (r) => { show({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: r.tempPassword, created: true }); setForm(blank); });
  }
  async function reset(m: TeamMember) { if (!window.confirm(t('staffResetConfirm', { name: m.name }))) return; await run(() => resetStaffPassword(m.user_id), (r) => show({ name: m.name, email: m.email, password: r.tempPassword, created: false })); }
  async function toggle(m: TeamMember) { if (!m.disabled && !window.confirm(t('staffDisableConfirm', { name: m.name }))) return; await run(() => setStaffActive(m.user_id, m.disabled), () => undefined); }
  async function copy() { try { await navigator.clipboard.writeText(cred?.password ?? ''); setCopied(true); } catch { setCopied(false); } }

  return (
    <section className="space-y-2" data-testid="team-section">
      <h2 className="font-bold">{t('teamTitle')}</h2><p className="text-sm text-muted">{t('teamIntro')}</p>
      {errKey && <p role="alert" className="text-danger" data-testid="team-error">{t(errKey)}</p>}
      {loadFailed && <p role="alert" className="text-danger">{t('error')}</p>}
      {cred && (
        <div className="card space-y-2 border-warn" role="status" data-testid="temp-credential">
          <b>{t(cred.created ? 'staffCreated' : 'staffResetDone', { name: cred.name })}</b>
          {cred.email && <p className="text-sm">{t('email')}: <span className="font-mono" data-testid="temp-email">{cred.email}</span></p>}
          <p className="text-sm">{t('tempPassword')}: <code className="rounded bg-line/50 px-2 py-1 font-mono text-base font-bold" data-testid="temp-password">{cred.password}</code></p>
          <p className="text-sm text-warn">{t('tempPasswordHint')}</p>
          <div className="flex flex-wrap gap-2"><button className="btn !min-h-10 !w-auto text-base" onClick={() => void copy()} data-testid="temp-copy">{copied ? t('copied') : t('copyPassword')}</button><button className="btn !min-h-10 !w-auto text-base" onClick={() => setCred(null)} data-testid="temp-dismiss">{t('staffShared')}</button></div>
        </div>
      )}
      <ul className="space-y-2" data-testid="team-list">
        {(team ?? []).map((m) => (
          <li key={m.user_id} className="card flex flex-wrap items-center gap-2" data-testid="team-member">
            <div className="min-w-0 flex-1"><b>{m.name}</b>{m.user_id === profile?.user_id && <span className="text-muted"> ({t('you')})</span>}
              {m.disabled && <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn" data-testid="disabled-badge">{t('disabled')}</span>}
              <div className="truncate text-sm text-muted">{t(`role_${m.role}`)}{m.email ? ` · ${m.email}` : ''}</div></div>
            {m.user_id !== profile?.user_id && <div className="flex gap-2"><button className="btn !min-h-10 !w-auto text-sm" disabled={busy} onClick={() => void reset(m)} data-testid="member-reset">{t('resetPassword')}</button><button className="btn !min-h-10 !w-auto text-sm" disabled={busy} onClick={() => void toggle(m)} data-testid="member-toggle">{t(m.disabled ? 'enable' : 'disable')}</button></div>}
          </li>
        ))}
      </ul>
      <form className="card space-y-2" onSubmit={(e) => { e.preventDefault(); void add(); }} data-testid="team-form">
        <b>{t('addMember')}</b>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block"><span className="label">{t('name')}</span><input className="input !min-h-10 !text-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" data-testid="member-name" /></label>
          <label className="block"><span className="label">{t('email')}</span><input className="input !min-h-10 !text-base" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" data-testid="member-email" /></label>
          <label className="block"><span className="label">{t('role')}</span><select className="input !min-h-10 !text-base" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} data-testid="member-role">{STAFF_ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}</select></label>
          <label className="block"><span className="label">{t('phoneOptional')}</span><input className="input !min-h-10 !text-base" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="off" data-testid="member-phone" /></label>
        </div>
        <button className="btn btn-primary !min-h-10 !w-auto text-base" type="submit" disabled={busy} data-testid="member-add">{t('addMember')}</button>
      </form>
    </section>
  );
}
