import { db } from './db.ts';
/** Offline copies of master data and recent lots; wiped on sign-out or when a different person signs in. */
export async function clearCaches() { await Promise.all([db.lotCache.clear(), db.kv.clear()]); }
export async function putKV(key: string, value: unknown) { await db.kv.put({ key, value }); }
export async function getKV<T>(key: string): Promise<T | undefined> { return (await db.kv.get(key))?.value as T | undefined; }
