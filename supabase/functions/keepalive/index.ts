// Keeps the free-tier project from pausing (daily pg_cron job or GitHub Actions) and re-asserts the public demo logins.
import { adminClient, hasCronSecret } from '../_shared/clients.ts';
import { json } from '../_shared/http.ts';
import { healDemoLogins } from '../_shared/demoSeed.ts';
Deno.serve(async (req) => {
  if (!hasCronSecret(req)) return json({ error: 'unauthorized' }, 401);
  const db = adminClient();
  const r = await db.from('organizations').select('id', { count: 'exact', head: true });
  return json({ ok: !r.error, demoLogins: await healDemoLogins(db).catch(() => 0) });
});
