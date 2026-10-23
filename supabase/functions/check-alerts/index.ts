import { adminClient, hasCronSecret } from '../_shared/clients.ts';
import { env, json } from '../_shared/http.ts';
import { runSweep } from '../_shared/sweep.ts';
Deno.serve(async (req) => {
  if (!hasCronSecret(req)) return json({ error: 'unauthorized' }, 401);
  return json({ ok: true, ...(await runSweep(adminClient(), { telegramToken: env('TELEGRAM_BOT_TOKEN') })) });
});
