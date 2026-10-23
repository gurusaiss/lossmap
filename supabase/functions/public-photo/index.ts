// Signed link for the produce photo on the public farmer report; only for the lot the token belongs to.
import { adminClient } from '../_shared/clients.ts';
import { json, preflight } from '../_shared/http.ts';
Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const token = new URL(req.url).searchParams.get('token') ?? ((await req.json().catch(() => ({}))) as { token?: string }).token ?? '';
  const admin = adminClient();
  const r = await admin.rpc('get_public_lot_report', { p_token: token });
  const path = (r.data as { produce_photo_path: string | null }[] | null)?.[0]?.produce_photo_path;
  if (!path || path.includes('..')) return json({ url: null }, 404);
  const s = await admin.storage.from('photos').createSignedUrl(path, 300);
  return json({ url: s.data?.signedUrl ?? null });
});
