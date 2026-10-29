export async function sendTelegram(f: typeof fetch, token: string, chatId: number, text: string): Promise<boolean> {
  try {
    const r = await f(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}
/** Pulls the one-time link token from "/start <token>". */
export const parseStart = (text: unknown): string | null => { const m = typeof text === 'string' ? /^\/start\s+([0-9a-f]{16,64})$/i.exec(text.trim()) : null; return m ? m[1]! : null; };
