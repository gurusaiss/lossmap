import { remote } from '../api.ts';
import { db } from './db.ts';
import { syncOutbox } from './sync.ts';

let userId: string | null = null; let running = false; let started = false;
export const setSyncUser = (id: string | null) => { userId = id; };
export async function triggerSync() {
  if (running || !userId || !navigator.onLine) return;
  running = true;
  try { await syncOutbox(db, remote, userId); } finally { running = false; }
}
/** Sync on app open, when the connection returns, on return to the app, and every 30 s while anything waits. */
export function startSyncLoop() {
  if (started) return; started = true;
  addEventListener('online', () => void triggerSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void triggerSync(); });
  setInterval(() => void triggerSync(), 30_000);
  try { void navigator.storage?.persist?.(); } catch { /* ignore */ } // ask the browser not to evict the queue
}
