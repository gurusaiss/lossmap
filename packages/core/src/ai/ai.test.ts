import { describe, expect, it } from 'vitest';
import { AiError, callWithFallback, computeExposure, generateTempPassword, parseQualityResult, parseScaleResult, parseStart, validateNewPassword, validateStaffInput, cellOf } from '../index.ts';

describe('scale parsing', () => {
  it('accepts a confident kg reading', () => expect(parseScaleResult({ readable: true, value: 250, unit: 'kg', confidence: 0.93 })).toMatchObject({ weightKg: 250, needsManual: false }));
  it('converts grams and pounds', () => { expect(parseScaleResult({ readable: true, value: 12500, unit: 'g', confidence: 0.9 }).weightKg).toBe(12.5); expect(parseScaleResult({ readable: true, value: 100, unit: 'lb', confidence: 0.9 }).weightKg).toBe(45.36); });
  it('low confidence is never pre-filled', () => expect(parseScaleResult({ readable: true, value: 250, unit: 'kg', confidence: 0.4 })).toMatchObject({ weightKg: null, needsManual: true }));
  it('unreadable, unknown unit and garbage all fall back to typing', () => { for (const x of [{ readable: false, value: null, confidence: 0.9 }, { readable: true, value: 5, unit: 'stone', confidence: 0.9 }, null, 'x']) expect(parseScaleResult(x).needsManual).toBe(true); });
});
describe('quality parsing', () => {
  it('normalises to 100', () => { const q = parseQualityResult({ good_pct: 72, damaged_pct: 20, rotten_pct: 7, confidence: 0.6 })!; expect(q.goodPct + q.damagedPct + q.rottenPct).toBeCloseTo(100, 5); });
  it('rejects answers that do not add up or are negative', () => { expect(parseQualityResult({ good_pct: 10, damaged_pct: 10, rotten_pct: 10 })).toBeNull(); expect(parseQualityResult({ good_pct: -5, damaged_pct: 100, rotten_pct: 5 })).toBeNull(); });
});
describe('gemini fallback', () => {
  const ok = (text: string) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  const base = { apiKey: 'k', prompt: 'p', schema: {}, imageBase64: 'x' };
  it('uses the fallback model after a rate limit', async () => {
    const seen: string[] = [];
    const f = (async (url: URL | string) => { seen.push(String(url)); return seen.length === 1 ? new Response('', { status: 429 }) : ok('{"a":1}')(); }) as unknown as typeof fetch;
    expect(await callWithFallback(f, ['m1', 'm2'], base)).toEqual({ a: 1 }); expect(seen[1]).toContain('m2');
  });
  it('no model configured is a clean reason, not a crash', async () => { await expect(callWithFallback(fetch, [], base)).rejects.toMatchObject({ reason: 'not_configured' }); });
  it('bad JSON becomes bad_json', async () => { await expect(callWithFallback(ok('nope') as unknown as typeof fetch, ['m'], base)).rejects.toBeInstanceOf(AiError); });
});
describe('weather exposure', () => {
  const h = new Map<string, number>([['2026-10-10T04', 28], ['2026-10-10T05', 33], ['2026-10-10T06', 35], ['2026-10-10T07', 31]]);
  const start = Date.parse('2026-10-10T04:00:00Z'), end = Date.parse('2026-10-10T08:00:00Z');
  it('counts hours above the threshold', () => expect(computeExposure(h, start, end, 30)).toEqual({ heatHours: 3, avgTempC: 31.8, maxTempC: 35 }));
  it('no data means null, never an invented temperature', () => expect(computeExposure(new Map(), start, end, 30)).toBeNull());
  it('cells share nearby places', () => expect(cellOf(13.5512, 78.5049)).toBe(cellOf(13.5601, 78.5001)));
});
describe('staff helpers', () => {
  it('validates and tidies input, defaulting language by role', () => {
    const v = validateStaffInput({ name: '  Lakshmi   Devi ', email: ' L@X.CO ', role: 'field_agent' });
    expect(v).toMatchObject({ ok: true, value: { name: 'Lakshmi Devi', email: 'l@x.co', language: 'te' } });
    expect(validateStaffInput({ name: 'A', email: 'a@b.co', role: 'manager' }).ok).toBe(false);
    expect(validateStaffInput({ name: 'Ok Name', email: 'bad', role: 'manager' }).ok).toBe(false);
    expect(validateStaffInput({ name: 'Ok Name', email: 'a@b.co', role: 'root' }).ok).toBe(false);
  });
  it('temporary passwords meet the password rules and are not constant', () => {
    const a = generateTempPassword(), b = generateTempPassword();
    expect(a).toHaveLength(12); expect(validateNewPassword(a)).toBeNull(); expect(a).not.toBe(b); expect(a).not.toMatch(/[0OIl1]/);
  });
  it('password rules', () => { expect(validateNewPassword('short1A')).toBe('tooShort'); expect(validateNewPassword('alllowercase99')).toBe('tooSimple'); expect(validateNewPassword('Fresh-Passw0rd')).toBeNull(); });
  it('telegram start token', () => { expect(parseStart('/start abcdef0123456789abcdef0123456789')).toBe('abcdef0123456789abcdef0123456789'); expect(parseStart('/start nope')).toBeNull(); });
});
