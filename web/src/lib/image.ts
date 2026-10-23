/** Resize to 1280 px on the long edge and re-encode as JPEG (about 200 KB), so 1 GB of storage holds thousands of photos. */
export async function compress(blob: Blob, maxEdge = 1280, quality = 0.7): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', quality));
}
export const toBase64 = (b: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
export async function sha256Hex(b: Blob): Promise<string> { const d = await crypto.subtle.digest('SHA-256', await b.arrayBuffer()); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
