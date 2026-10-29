import type { CropParams } from './types.ts';

export type AlertSeverity = 'warn' | 'critical';
export interface AlertDecision { severity: AlertSeverity; rule: 'A1_wait_warning' | 'A2_wait_exceeded' | 'A3_heat_wait'; message: string }

/** Lot still waiting: warn at 75% of the safe wait, critical at 100%, and say so when it is also hot. */
export function evaluateWaiting(lotCode: string, centre: string, waitedH: number, tempC: number | null, crop: CropParams): AlertDecision | null {
  const h = Math.round(waitedH * 10) / 10;
  const hot = tempC != null && tempC >= crop.heatThresholdC;
  if (waitedH >= crop.maxSafeWaitHours) {
    return { severity: 'critical', rule: hot ? 'A3_heat_wait' : 'A2_wait_exceeded', message: `Lot ${lotCode} has waited ${h} h${hot ? ` at ${Math.round(tempC!)}°C` : ''} at ${centre}. Dispatch now.` };
  }
  if (waitedH >= crop.maxSafeWaitHours * 0.75) {
    return { severity: 'warn', rule: 'A1_wait_warning', message: `Lot ${lotCode} has waited ${h} h at ${centre} (limit ${crop.maxSafeWaitHours} h). Plan dispatch.` };
  }
  return null;
}
