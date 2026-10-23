import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import te from './te.json';

const src = join(import.meta.dirname, '..');
const files = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !n.includes('.test.') ? [p] : []; });
describe('translations', () => {
  it('English and Telugu have exactly the same keys', () => expect(Object.keys(te).sort()).toEqual(Object.keys(en).sort()));
  it('no Telugu string is empty and interpolation variables match', () => {
    for (const [k, v] of Object.entries(en)) { const t = (te as Record<string, string>)[k]!; expect(t.trim(), k).not.toBe(''); expect((t.match(/{{\w+}}/g) ?? []).sort(), k).toEqual((v.match(/{{\w+}}/g) ?? []).sort()); }
  });
  it('every literal key used in the code exists', () => {
    const missing = new Set<string>();
    for (const f of files(src)) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*(['"])([A-Za-z0-9_]+)\1/g)) if (!(m[2]! in en)) missing.add(m[2]!);
    expect([...missing]).toEqual([]);
  });
  it('every dynamic key family has all its members', () => {
    const fam: Record<string, string[]> = { stage_: ['farm_pickup', 'centre_arrival', 'centre_dispatch', 'storage_in', 'storage_out', 'factory_arrival', 'handling_in', 'waiting', 'transport', 'storage', 'other'], cause_: ['R1_heat_during_waiting', 'R2_waited_too_long', 'R3_transport_delay', 'R4_handling_damage', 'within_tolerance', 'unexplained'], role_: ['manager', 'field_agent', 'factory_receiver'], source_: ['ai', 'ai_edited', 'manual'], severity_: ['warn', 'critical'], status_: ['open', 'delivered'], queue_: ['farmer', 'lot', 'checkpoint'], preset_: ['good', 'fair', 'poor'], centreType_: ['collection_centre', 'factory', 'storage'] };
    for (const [p, ms] of Object.entries(fam)) for (const m of ms) expect(`${p}${m}` in en, `${p}${m}`).toBe(true);
  });
});
