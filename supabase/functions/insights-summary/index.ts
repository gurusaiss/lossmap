// Two callers: the weekly cron (shared secret; every organisation) and a manager asking for their own summary now.
import { adminClient, hasCronSecret, requireUser } from '../_shared/clients.ts';
import { takeDailyBudget } from '../_shared/budget.ts';
import { env, json, preflight } from '../_shared/http.ts';
import { generateInsight } from '../_shared/insightsJob.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const admin = adminClient();
  if (hasCronSecret(req)) {
    const orgs = ((await admin.from('organizations').select('id')).data ?? []) as { id: string }[];
    const started = Date.now(); let generated = 0;
    for (const o of orgs) { if (Date.now() - started > 90_000) break; if ((await generateInsight(admin, o.id)) !== 'none') generated++; }
    return json({ ok: true, organisations: orgs.length, generated });
  }
  const caller = await requireUser(req); if (caller instanceof Response) return caller;
  if (caller.role !== 'manager') return json({ error: 'managers only' }, 403);
  if (!(await takeDailyBudget(admin, `insights:${caller.orgId}`, Number(env('INSIGHTS_ORG_DAILY_LIMIT', '20'))))) return json({ error: 'daily limit' }, 429);
  const days = Math.min(90, Math.max(1, Number(((await req.json().catch(() => ({}))) as { days?: number }).days ?? 14)));
  const source = await generateInsight(admin, caller.orgId, days);
  if (source === 'none') return json({ error: 'no data yet' }, 404);
  const row = (await admin.from('insights').select('text_en, text_te, recommendation').eq('org_id', caller.orgId).order('created_at', { ascending: false }).limit(1)).data?.[0];
  return json({ ...row, source });
});
