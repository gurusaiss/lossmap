import type { Profile } from './db.ts';
// The phone remembers who signed in, so the capture screens open with no connection (even when the access token has expired).
export interface Identity { userId: string; profile: Profile; orgName: string | null; orgIsDemo: boolean }
const KEY = 'lossmap.identity';
export function loadIdentity(): Identity | null { try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Identity) : null; } catch { return null; } }
export function saveIdentity(i: Identity) { try { localStorage.setItem(KEY, JSON.stringify(i)); } catch { /* storage blocked */ } }
export function clearIdentity() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
