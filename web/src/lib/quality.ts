// Manual quality presets (good / damaged / rotten %) used when the worker does not use the AI estimate.
export const QUALITY_PRESETS = { good: [90, 8, 2], fair: [65, 25, 10], poor: [40, 35, 25] } as const;
export type PresetKey = keyof typeof QUALITY_PRESETS;
