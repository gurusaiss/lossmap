import { useEffect, useState } from 'react';
import { loadMaster, type MasterData } from './api.ts';
import { getKV, putKV } from './offline/cache.ts';

const timeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
/** Master data from the network when reachable (and cached), else the offline copy. An offline phone never waits on a retry. */
export async function loadMasterCached(): Promise<MasterData | null> {
  if (navigator.onLine) { try { const m = await timeout(loadMaster(), 6000); await putKV('master', m); return m; } catch { /* fall through to cache */ } }
  return (await getKV<MasterData>('master')) ?? null;
}
export function useMaster() {
  const [m, setM] = useState<MasterData | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = () => loadMasterCached().then((x) => { setM(x); setFailed(!x); });
  useEffect(() => { void reload(); }, []);
  return { master: m, failed, reload, setMaster: setM };
}
