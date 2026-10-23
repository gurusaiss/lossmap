import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isConfigured } from './supabase.ts';
import type { Profile } from './db.ts';
import { setLang } from '../i18n/index.ts';
import { setSyncUser, startSyncLoop, triggerSync } from './offline/loop.ts';
import { clearCaches } from './offline/cache.ts';
import { clearIdentity, loadIdentity, saveIdentity, type Identity } from './identity.ts';

interface AuthState {
  loading: boolean; signedIn: boolean; session: Session | null; profile: Profile | null;
  /** The server answered but this login has no active profile (disabled, or not set up). */
  profileMissing: boolean; orgName: string | null; orgIsDemo: boolean;
  signIn: (email: string, password: string) => Promise<string | null>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);
const withTimeout = <T,>(p: PromiseLike<T>, ms: number) => new Promise<T>((res, rej) => { const t = setTimeout(() => rej(new Error('timed out')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  const applyIdentity = useCallback((i: Identity) => {
    // cached farmers, prices and lots belong to the previous user: never show them to a different person
    try { if (localStorage.getItem('lossmap.cacheUser') !== i.userId) { void clearCaches(); localStorage.setItem('lossmap.cacheUser', i.userId); } } catch { /* storage blocked */ }
    setIdentity(i); setSyncUser(i.userId);
    if (!localStorage.getItem('lossmap.lang')) setLang(i.profile.language);
    startSyncLoop(); void triggerSync();
  }, []);

  /** Profile from the server when reachable; otherwise the remembered one for the same user. Never leaves the app waiting. */
  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) { setIdentity(null); return; }
    const remembered = loadIdentity();
    const fallback = remembered && remembered.userId === userId ? remembered : null;
    if (!navigator.onLine) { if (fallback) applyIdentity(fallback); return; }
    try {
      const { data, error } = await withTimeout(supabase.from('profiles').select('user_id, org_id, role, name, language, organizations(name, is_demo)').eq('user_id', userId).maybeSingle(), 6000);
      if (error) throw new Error(error.message);
      if (data) {
        const { organizations, ...p } = data as unknown as Profile & { organizations: { name: string; is_demo: boolean } | null };
        const next: Identity = { userId, profile: p, orgName: organizations?.name ?? null, orgIsDemo: organizations?.is_demo === true };
        saveIdentity(next); setProfileMissing(false); applyIdentity(next);
      } else { clearIdentity(); setIdentity(null); setSyncUser(null); setProfileMissing(true); } // disabled: stop offline use too
    } catch { if (fallback) applyIdentity(fallback); }
  }, [applyIdentity]);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      else if (!navigator.onLine) { const r = loadIdentity(); if (r) applyIdentity(r); } // expired token cannot refresh offline: keep working
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      if (evt === 'SIGNED_OUT') { clearIdentity(); setIdentity(null); setProfileMissing(false); return; }
      if (s) setTimeout(() => void loadProfile(s.user.id), 0); // never re-enter supabase-js from inside its own callback
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile, applyIdentity]);

  const signIn = useCallback(async (email: string, password: string) => { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); return error ? error.message : null; }, []);
  const signOut = useCallback(async () => {
    clearIdentity(); setSyncUser(null);
    try { localStorage.removeItem('lossmap.cacheUser'); } catch { /* ignore */ }
    await clearCaches().catch(() => undefined); // unsent work stays queued and uploads when the same person signs in again
    setIdentity(null); setProfileMissing(false); setSession(null);
    await supabase.auth.signOut().catch(() => undefined);
  }, []);

  const value = useMemo<AuthState>(() => ({ loading, signedIn: Boolean(session) || identity !== null, session, profile: identity?.profile ?? null, profileMissing, orgName: identity?.orgName ?? null, orgIsDemo: identity?.orgIsDemo ?? false, signIn, signOut }), [loading, session, identity, profileMissing, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth(): AuthState { const v = useContext(Ctx); if (!v) throw new Error('useAuth outside AuthProvider'); return v; }
