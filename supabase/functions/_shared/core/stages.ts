import type { SegmentKind, Stage } from './types.ts';

export const STAGE_ORDER: Stage[] = ['farm_pickup', 'centre_arrival', 'centre_dispatch', 'storage_in', 'storage_out', 'factory_arrival'];
export const stageRank = (s: Stage) => STAGE_ORDER.indexOf(s);

/** What happened between two consecutive checkpoints. */
export function segmentKind(from: Stage, to: Stage): SegmentKind {
  if (from === 'farm_pickup' && to === 'centre_arrival') return 'handling_in';
  if (from === 'centre_arrival' && to === 'centre_dispatch') return 'waiting';
  if (to === 'storage_out' && from === 'storage_in') return 'storage';
  if ((from === 'centre_dispatch' || from === 'storage_out') && to === 'factory_arrival') return 'transport';
  return 'other';
}

/** The stage a worker most likely records next (suggestion only). */
export function nextStage(last: Stage | null): Stage {
  if (!last) return 'farm_pickup';
  if (last === 'farm_pickup') return 'centre_arrival';
  if (last === 'centre_arrival') return 'centre_dispatch';
  if (last === 'storage_in') return 'storage_out';
  return 'factory_arrival';
}
