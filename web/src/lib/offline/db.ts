import Dexie, { type Table } from 'dexie';
import type { Stage } from '@lossmap/core';

export type QStatus = 'pending' | 'rejected';
interface Base { id: string; userId: string; status: QStatus; error?: string; createdAt: number }
export interface QFarmer extends Base { row: { id: string; org_id: string; name: string; village: string } }
export interface QLot extends Base { row: { id: string; org_id: string; short_code: string; qr_code: string; farmer_id: string; crop_id: string; crate_count: number | null } }
export interface QCheckpoint extends Base {
  row: Record<string, unknown> & { id: string; org_id: string; lot_id: string; stage: Stage };
  scale?: Blob; produce?: Blob; scalePath?: string; producePath?: string; lotLabel: string;
}
export interface CachedLot { id: string; short_code: string; data: unknown }
export interface KV { key: string; value: unknown }

export class LossDb extends Dexie {
  farmers!: Table<QFarmer, string>; lots!: Table<QLot, string>; checkpoints!: Table<QCheckpoint, string>;
  lotCache!: Table<CachedLot, string>; kv!: Table<KV, string>;
  constructor(name = 'lossmap') {
    super(name);
    this.version(1).stores({ farmers: 'id, userId, [userId+status]', lots: 'id, userId, [userId+status]', checkpoints: 'id, userId, [userId+status]', lotCache: 'id, short_code', kv: 'key' });
  }
}
export const db = new LossDb();
