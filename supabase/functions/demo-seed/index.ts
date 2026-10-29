// "Load demo data" / "Reset demo". Callable by the service role (first-time bootstrap) or by a manager of the demo organisation.
import { DEMO_ORG_ID } from '../_shared/core/index.ts';
import { adminClient, isServiceRole, requireUser } from '../_shared/clients.ts';
import { json, preflight } from '../_shared/http.ts';
import { loadDemo, resetDemo } from '../_shared/demoSeed.ts';

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!isServiceRole(req)) {
    const caller = await requireUser(req); if (caller instanceof Response) return caller;
    if (caller.role !== 'manager' || caller.orgId !== DEMO_ORG_ID) return json({ error: 'demo managers only' }, 403);
  }
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const db = adminClient();
  try {
    if (body.action === 'reset') { await resetDemo(db); return json({ ok: true, action: 'reset' }); }
    if (body.action === 'load') return json({ ok: true, action: 'load', ...(await loadDemo(db)) });
    return json({ error: "action must be 'load' or 'reset'" }, 400);
  } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'failed' }, 500); }
});
