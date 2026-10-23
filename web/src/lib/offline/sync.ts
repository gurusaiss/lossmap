import type { LossDb, QCheckpoint, QFarmer, QLot } from './db.ts';

export interface Remote {
  saveFarmer(row: QFarmer['row']): Promise<void>;
  saveLot(row: QLot['row']): Promise<void>;
  saveCheckpoint(row: QCheckpoint['row']): Promise<void>;
  uploadPhoto(path: string, blob: Blob): Promise<void>;
  /** best effort: attach heat exposure after the row is stored */
  enrich(checkpointId: string): Promise<void>;
}
/** A rejection comes from the server (bad data); anything else is a dropped connection and stops the run. */
export class Rejected extends Error {}
const isNetwork = (e: unknown) => !(e instanceof Rejected);

export interface SyncResult { sent: number; rejected: number; stopped: boolean }

/** At-least-once delivery with idempotent upserts: farmers, then lots, then checkpoints (photos first). Only this user's items. */
export async function syncOutbox(d: LossDb, remote: Remote, userId: string): Promise<SyncResult> {
  const r: SyncResult = { sent: 0, rejected: 0, stopped: false };
  const run = async <T extends { id: string; error?: string }>(items: T[], send: (x: T) => Promise<void>, mark: (id: string, error: string) => Promise<unknown>, done: (id: string) => Promise<unknown>) => {
    for (const x of items) {
      if (r.stopped) return;
      try { await send(x); await done(x.id); r.sent++; }
      catch (e) { if (isNetwork(e)) { r.stopped = true; return; } await mark(x.id, (e as Error).message); r.rejected++; }
    }
  };
  await run(await d.farmers.where({ userId, status: 'pending' }).sortBy('createdAt'), (x) => remote.saveFarmer(x.row), (id, error) => d.farmers.update(id, { status: 'rejected', error }), (id) => d.farmers.delete(id));
  await run(await d.lots.where({ userId, status: 'pending' }).sortBy('createdAt'), (x) => remote.saveLot(x.row), (id, error) => d.lots.update(id, { status: 'rejected', error }), (id) => d.lots.delete(id));
  await run(await d.checkpoints.where({ userId, status: 'pending' }).sortBy('createdAt'), async (x) => {
    if (x.scale && x.scalePath) await remote.uploadPhoto(x.scalePath, x.scale);
    if (x.produce && x.producePath) await remote.uploadPhoto(x.producePath, x.produce);
    await remote.saveCheckpoint(x.row);
    void remote.enrich(x.row.id).catch(() => undefined);
  }, (id, error) => d.checkpoints.update(id, { status: 'rejected', error }), (id) => d.checkpoints.delete(id));
  return r;
}
