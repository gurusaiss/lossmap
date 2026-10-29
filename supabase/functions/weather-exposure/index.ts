import { adminClient, requireUser } from '../_shared/clients.ts';
import { takeDailyBudget } from '../_shared/budget.ts';
import { env, json, preflight } from '../_shared/http.ts';
import { processExposure } from '../_shared/exposure.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const caller = await requireUser(req); if (caller instanceof Response) return caller;
  const body = (await req.json().catch(() => ({}))) as { checkpoint_id?: unknown };
  if (typeof body.checkpoint_id !== 'string') return json({ error: 'checkpoint_id required' }, 400);
  // the caller must be able to see the checkpoint (row-level security), so one organisation cannot trigger another's lookups
  const visible = await caller.db.from('checkpoints').select('id').eq('id', body.checkpoint_id).maybeSingle();
  if (!visible.data) return json({ error: 'not found' }, 404);
  const admin = adminClient();
  if (!(await takeDailyBudget(admin, `weather:${caller.orgId}`, Number(env('WEATHER_ORG_DAILY_LIMIT', '600'))))) return json({ result: 'budget' });
  return json({ result: await processExposure(admin, body.checkpoint_id) });
});
