import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LossDb } from './db.ts';
import { pendingCount, queueCheckpoint, queueFarmer, queueLot } from './outbox.ts';
import { Rejected, syncOutbox, type Remote } from './sync.ts';
import { newShortCode, parseLotCode } from '../lotCode.ts';

let d: LossDb; let calls: string[]; let failNetwork: boolean; let reject: string | null;
const remote: Remote = {
  async saveFarmer() { calls.push('farmer'); },
  async saveLot() { calls.push('lot'); },
  async saveCheckpoint() { if (failNetwork) throw new Error('network'); if (reject) throw new Rejected(reject); calls.push('checkpoint'); },
  async uploadPhoto(p) { calls.push(`photo:${p}`); },
  async enrich() { calls.push('enrich'); },
};
const cp = (id: string) => ({ row: { id, org_id: 'o', lot_id: 'l', stage: 'farm_pickup' as const }, scale: new Blob(['x']), scalePath: `o/${id}.jpg`, lotLabel: 'T-1' });
beforeEach(async () => { d = new LossDb(`t${Math.random()}`); calls = []; failNetwork = false; reject = null; });

describe('outbox sync', () => {
  it('sends farmer, then lot, then photos, then checkpoint', async () => {
    await queueCheckpoint(d, 'u1', cp('c1')); await queueLot(d, 'u1', { id: 'l', org_id: 'o', short_code: 'T-1', qr_code: 'T-1', farmer_id: 'f', crop_id: 'c', crate_count: 1 }); await queueFarmer(d, 'u1', { id: 'f', org_id: 'o', name: 'R', village: 'V' });
    expect(await pendingCount(d, 'u1')).toBe(3);
    const r = await syncOutbox(d, remote, 'u1');
    expect(calls.slice(0, 4)).toEqual(['farmer', 'lot', 'photo:o/c1.jpg', 'checkpoint']); expect(r.sent).toBe(3); expect(await pendingCount(d, 'u1')).toBe(0);
  });
  it('a dropped connection keeps everything queued and stops', async () => {
    await queueCheckpoint(d, 'u1', cp('c1')); await queueCheckpoint(d, 'u1', cp('c2')); failNetwork = true;
    const r = await syncOutbox(d, remote, 'u1');
    expect(r.stopped).toBe(true); expect(await pendingCount(d, 'u1')).toBe(2);
  });
  it('a server rejection marks only that item', async () => {
    await queueCheckpoint(d, 'u1', cp('c1')); reject = 'violates check';
    const r = await syncOutbox(d, remote, 'u1');
    expect(r.rejected).toBe(1); expect((await d.checkpoints.get('c1'))?.status).toBe('rejected'); expect(await pendingCount(d, 'u1')).toBe(0);
  });
  it('items belong to their owner: another user never sends them', async () => {
    await queueCheckpoint(d, 'u1', cp('c1'));
    expect((await syncOutbox(d, remote, 'u2')).sent).toBe(0); expect(await pendingCount(d, 'u1')).toBe(1);
  });
  it('re-sending is idempotent in effect: a second run has nothing to send', async () => {
    await queueCheckpoint(d, 'u1', cp('c1')); await syncOutbox(d, remote, 'u1');
    expect((await syncOutbox(d, remote, 'u1')).sent).toBe(0);
  });
});
describe('lot codes', () => {
  it('short codes use the crop letter and no look-alikes', () => expect(newShortCode('t')).toMatch(/^T-[A-HJKMNP-Z2-9]{5}$/));
  it('parses QR urls, ids and typed codes', () => {
    const id = '5f1c0a52-7d3b-4c2e-9a41-0123456789ab';
    expect(parseLotCode(`https://app.example/l/${id}`)).toBe(id); expect(parseLotCode('t-1043')).toBe('t-1043'); expect(parseLotCode('nonsense text')).toBeNull();
  });
});
