import type { Db } from './clients.ts';
/** Counts one use of a daily budget; false once the limit is reached or the check fails (fail closed). */
export async function takeDailyBudget(admin: Db, key: string, limit: number): Promise<boolean> {
  const r = await admin.rpc('take_ai_budget', { p_task: key, p_limit: limit });
  return !r.error && r.data === true;
}
