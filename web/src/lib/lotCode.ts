const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)
export function newShortCode(prefix: string): string {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix.toUpperCase()}-${[...b].map((x) => ALPHABET[x % ALPHABET.length]).join('')}`;
}
export const isLotId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
/** The QR carries a URL ending in the lot id; people may also type the short code. */
export function parseLotCode(input: string): string | null {
  const t = input.trim();
  const fromUrl = /\/l\/([^/?#\s]+)/.exec(t)?.[1];
  const c = decodeURIComponent(fromUrl ?? t);
  return isLotId(c) || /^[A-Za-z]-[A-Za-z0-9]{3,8}$/.test(c) ? c : null;
}
