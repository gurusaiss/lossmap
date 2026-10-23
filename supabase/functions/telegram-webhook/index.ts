import { parseStart, sendTelegram } from '../_shared/core/index.ts';
import { adminClient } from '../_shared/clients.ts';
import { env, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const want = env('TELEGRAM_WEBHOOK_SECRET');
  if (!want || req.headers.get('x-telegram-bot-api-secret-token') !== want) return json({ error: 'unauthorized' }, 401);
  const u = (await req.json().catch(() => ({}))) as { message?: { text?: string; chat?: { id?: number } } };
  const chat = u.message?.chat?.id, token = parseStart(u.message?.text);
  if (typeof chat === 'number' && token) {
    const ok = (await adminClient().rpc('link_telegram_chat', { p_token: token, p_chat: chat })).data === true;
    await sendTelegram(fetch, env('TELEGRAM_BOT_TOKEN'), chat, ok ? 'LossMap alerts are connected to this chat.' : 'This link has expired. Create a new one in LossMap → Settings.');
  }
  return json({ ok: true });
});
