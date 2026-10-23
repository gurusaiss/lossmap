export type Fetcher = typeof fetch;
export class AiError extends Error { reason: string; constructor(reason: string, message?: string) { super(message ?? reason); this.reason = reason; } }

/** Calls Gemini's REST API with an image and a JSON schema. Model names come from configuration, never from code. */
export async function callGemini(f: Fetcher, o: { apiKey: string; model: string; prompt: string; schema: object; imageBase64?: string; timeoutMs?: number }): Promise<unknown> {
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

/** Primary model, then the fallback model; any failure ends in a reason the app turns into "type the weight". */
export async function callWithFallback(f: Fetcher, models: string[], o: Omit<Parameters<typeof callGemini>[1], 'model'>): Promise<unknown> {
  let last: AiError = new AiError('not_configured');
  for (const model of models.filter(Boolean)) {
    try { return await callGemini(f, { ...o, model }); } catch (e) { last = e instanceof AiError ? e : new AiError('upstream'); if (last.reason === 'rate_limited') continue; }
  }
  throw last;
}
