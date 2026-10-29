import type { LossDb, QCheckpoint, QFarmer, QLot } from './db.ts';

const now = () => Date.now();
export const queueFarmer = (d: LossDb, userId: string, row: QFarmer['row']) => d.farmers.put({ id: row.id, userId, status: 'pending', createdAt: now(), row });
export const queueLot = (d: LossDb, userId: string, row: QLot['row']) => d.lots.put({ id: row.id, userId, status: 'pending', createdAt: now(), row });
export const queueCheckpoint = (d: LossDb, userId: string, q: Omit<QCheckpoint, 'userId' | 'status' | 'createdAt' | 'id'>) =>
  d.checkpoints.put({ ...q, id: q.row.id, userId, status: 'pending', createdAt: now() });

export async function pendingCount(d: LossDb, userId: string) {
  const [a, b, c] = await Promise.all([d.farmers, d.lots, d.checkpoints].map((t) => (t as typeof d.lots).where({ userId, status: 'pending' }).count()));
  return (a ?? 0) + (b ?? 0) + (c ?? 0);
}
export async function listQueue(d: LossDb, userId: string) {
  const [f, l, c] = await Promise.all([d.farmers.where({ userId }).toArray(), d.lots.where({ userId }).toArray(), d.checkpoints.where({ userId }).toArray()]);
  return [...f.map((x) => ({ kind: 'farmer' as const, item: x })), ...l.map((x) => ({ kind: 'lot' as const, item: x })), ...c.map((x) => ({ kind: 'checkpoint' as const, item: x }))].sort((x, y) => x.item.createdAt - y.item.createdAt);
}
export async function retryItem(d: LossDb, kind: 'farmer' | 'lot' | 'checkpoint', id: string) {
  const t = kind === 'farmer' ? d.farmers : kind === 'lot' ? d.lots : d.checkpoints;
  await (t as typeof d.lots).update(id, { status: 'pending', error: undefined });
}
export async function discardItem(d: LossDb, kind: 'farmer' | 'lot' | 'checkpoint', id: string) {
  await (kind === 'farmer' ? d.farmers : kind === 'lot' ? d.lots : d.checkpoints).delete(id);
}
