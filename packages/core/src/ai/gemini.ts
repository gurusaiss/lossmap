export type Fetcher = typeof fetch;
export class AiError extends Error { reason: string; constructor(reason: string, message?: string) { super(message ?? reason); this.reason = reason; } }

export interface CallOptions { prompt: string; schema: object; imageBase64?: string; timeoutMs?: number }
export interface ProviderConfig { provider: 'groq' | 'gemini'; apiKey: string; model: string }

/** Calls Gemini's REST API with an image and a JSON schema. Model names come from configuration, never from code. */
export async function callGemini(f: Fetcher, o: { apiKey: string; model: string } & CallOptions): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.model)}:generateContent`;
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey }, signal: AbortSignal.timeout(o.timeoutMs ?? 12000),
      body: JSON.stringify({ contents: [{ parts: [{ text: o.prompt }, ...(o.imageBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: o.imageBase64 } }] : [])] }], generationConfig: { responseMimeType: 'application/json', responseSchema: o.schema, temperature: 0 } }),
    });
  } catch { throw new AiError('timeout'); }
  if (res.status === 429) throw new AiError('rate_limited');
  if (!res.ok) throw new AiError('upstream', `status ${res.status}`);
  const body = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiError('empty');
  try { return JSON.parse(text); } catch { throw new AiError('bad_json'); }
}

/** Calls Groq's OpenAI-compatible chat completions API with a vision-capable model. The prompt spells out the exact JSON shape; Groq's JSON mode (not a schema) enforces only "valid JSON". */
export async function callGroq(f: Fetcher, o: { apiKey: string; model: string } & CallOptions): Promise<unknown> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` }, signal: AbortSignal.timeout(o.timeoutMs ?? 12000),
      body: JSON.stringify({
        model: o.model, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: o.prompt }, ...(o.imageBase64 ? [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${o.imageBase64}` } }] : [])] }],
      }),
    });
  } catch { throw new AiError('timeout'); }
  if (res.status === 429) throw new AiError('rate_limited');
  if (!res.ok) throw new AiError('upstream', `status ${res.status}`);
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new AiError('empty');
  try { return JSON.parse(text); } catch { throw new AiError('bad_json'); }
}

function callProvider(f: Fetcher, cfg: ProviderConfig, o: CallOptions): Promise<unknown> {
  return cfg.provider === 'groq' ? callGroq(f, { ...o, apiKey: cfg.apiKey, model: cfg.model }) : callGemini(f, { ...o, apiKey: cfg.apiKey, model: cfg.model });
}

/** Tries each configured provider/model in order (Groq first, Gemini as fallback); any failure ends in a reason the app turns into "type the weight". A rate limit moves on to the next; other failures also move on, so one misconfigured provider cannot block the rest. */
export async function callWithFallback(f: Fetcher, configs: ProviderConfig[], o: CallOptions): Promise<unknown> {
  let last: AiError = new AiError('not_configured');
  for (const cfg of configs.filter((c) => c.apiKey && c.model)) {
    try { return await callProvider(f, cfg, o); } catch (e) { last = e instanceof AiError ? e : new AiError('upstream'); }
  }
  throw last;
}
