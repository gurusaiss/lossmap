export const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null);
export const env = (k: string, d = '') => Deno.env.get(k) ?? d;
