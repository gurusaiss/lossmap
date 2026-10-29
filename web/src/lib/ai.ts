import type { QualityResult, ScaleResult } from '@lossmap/core';
import { supabase } from './supabase.ts';
import { toBase64 } from './image.ts';

/** AI never blocks: null on any failure or when offline, and the worker types the value instead. */
async function call<T>(fn: string, blob: Blob): Promise<T | null> {
  if (!navigator.onLine) return null;
  try {
    const image_base64 = await toBase64(blob);
    const res = await Promise.race([supabase.functions.invoke(fn, { body: { image_base64 } }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
    const d = res.data as { ok?: boolean; result?: T } | null;
    return d?.ok && d.result ? d.result : null;
  } catch { return null; }
}
export const readScale = (b: Blob) => call<ScaleResult>('ai-read-scale', b);
export const estimateQuality = (b: Blob) => call<QualityResult>('ai-quality', b);
