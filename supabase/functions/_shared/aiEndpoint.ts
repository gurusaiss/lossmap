// Shared by ai-read-scale and ai-quality. AI never blocks the worker: every failure answers 200 { ok: false, reason }.
import { callWithFallback, AiError } from './core/index.ts';
import { adminClient, requireUser } from './clients.ts';
import { takeDailyBudget } from './budget.ts';
import { env, json, preflight } from './http.ts';

const MAX_B64 = 2_800_000;
async function sha256(b64: string) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b64)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

export function aiEndpoint(task: 'scale' | 'quality', prompt: string, schema: object, parse: (raw: unknown) => unknown | null) {
  return async (req: Request) => {
    const pre = preflight(req); if (pre) return pre;
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    const caller = await requireUser(req); if (caller instanceof Response) return caller;
    const body = (await req.json().catch(() => ({}))) as { image_base64?: unknown };
    if (typeof body.image_base64 !== 'string' || body.image_base64.length < 100 || body.image_base64.length > MAX_B64) return json({ ok: false, reason: 'bad_image' });
    const hash = await sha256(body.image_base64);
    const admin = adminClient();
    const hit = await admin.from('ai_cache').select('result').eq('photo_hash', hash).eq('task', task).maybeSingle();
    if (hit.data) return json({ ok: true, cached: true, result: hit.data.result });
    const globalOk = await takeDailyBudget(admin, task, Number(env('AI_DAILY_LIMIT', '400')));
    const orgOk = globalOk && (await takeDailyBudget(admin, `${task}:${caller.orgId}`, Number(env('AI_ORG_DAILY_LIMIT', '150'))));
    if (!orgOk) return json({ ok: false, reason: 'budget' });
    try {
      const raw = await callWithFallback(fetch, [env('GEMINI_MODEL'), env('GEMINI_MODEL_FALLBACK')], { apiKey: env('GEMINI_API_KEY'), prompt, schema, imageBase64: body.image_base64 });
      const result = parse(raw);
      if (!result) return json({ ok: false, reason: 'unusable' });
      await admin.from('ai_cache').upsert({ photo_hash: hash, task, result }, { onConflict: 'photo_hash,task' });
      return json({ ok: true, cached: false, result });
    } catch (e) {
      return json({ ok: false, reason: e instanceof AiError ? e.reason : 'upstream' });
    }
  };
}
