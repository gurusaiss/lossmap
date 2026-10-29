// Hourly temperature from Open-Meteo for a place and time window. Missing data is "unavailable", never invented.
export interface Exposure { heatHours: number; avgTempC: number; maxTempC: number }

/** One cell per 0.1 degree (about 11 km) so nearby lots share one cached response. */
export const cellOf = (lat: number, lng: number) => `${lat.toFixed(1)},${lng.toFixed(1)}`;

/** Hours of the window above the threshold, from hourly temperatures keyed by ISO hour (UTC). */
export function computeExposure(hourly: Map<string, number>, startMs: number, endMs: number, thresholdC: number): Exposure | null {
  const temps: number[] = [];
  for (let t = Math.floor(startMs / 3_600_000) * 3_600_000; t < endMs; t += 3_600_000) {
    const v = hourly.get(new Date(t).toISOString().slice(0, 13));
    if (typeof v === 'number') temps.push(v);
  }
  if (temps.length === 0) return null;
  const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
  return { heatHours: temps.filter((x) => x > thresholdC).length, avgTempC: Math.round(avg * 10) / 10, maxTempC: Math.max(...temps) };
}

export class WeatherWindowError extends Error {}

/** Forecast API with past_days covers up to 92 days back; reject absurd windows before any network call. */
export async function fetchHourly(f: typeof fetch, lat: number, lng: number, startMs: number, endMs: number, nowMs = Date.now()): Promise<Map<string, number>> {
  const days = Math.ceil((nowMs - startMs) / 86_400_000);
  if (endMs <= startMs || endMs - startMs > 14 * 86_400_000 || days > 92 || startMs > nowMs + 86_400_000) throw new WeatherWindowError('window out of range');
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({ latitude: lat.toFixed(2), longitude: lng.toFixed(2), hourly: 'temperature_2m', past_days: String(Math.max(0, days)), forecast_days: '2', timezone: 'GMT' }).toString();
  const res = await f(u, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = (await res.json()) as { hourly?: { time: string[]; temperature_2m: (number | null)[] } };
  const m = new Map<string, number>();
  j.hourly?.time.forEach((t, i) => { const v = j.hourly!.temperature_2m[i]; if (typeof v === 'number') m.set(t.slice(0, 13), v); });
  return m;
}
