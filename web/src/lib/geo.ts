export interface Fix { lat: number; lng: number; accuracy: number }
/** One position fix; never blocks saving. Resolves null when denied, unavailable or slow. */
export const getPosition = (timeoutMs = 6000): Promise<Fix | null> => new Promise((res) => {
  if (!navigator.geolocation) return res(null);
  const t = setTimeout(() => res(null), timeoutMs + 500);
  navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); }, () => { clearTimeout(t); res(null); }, { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 });
});
