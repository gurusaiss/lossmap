import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { inr, pct } from '../../lib/manager/format.ts';

maplibregl.setWorkerUrl(workerUrl);
export interface MapCentre { id: string; name: string; lat: number; lng: number; lossRs: number; lossPct: number }
const readableOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#111' : '#fff'; };

export default function CentreMap({ centres }: { centres: MapCentre[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || centres.length === 0) return;
    const map = new maplibregl.Map({ container: el.current, style: 'https://tiles.openfreemap.org/styles/positron', center: [centres[0]!.lng, centres[0]!.lat], zoom: 8 });
    const max = Math.max(...centres.map((c) => c.lossPct), 1);
    const bounds = new maplibregl.LngLatBounds();
    centres.forEach((c) => {
      const bg = c.lossPct >= max * 0.75 ? '#c2410c' : '#14532d';
      const m = document.createElement('div');
      m.setAttribute('data-testid', 'map-marker'); m.textContent = pct(c.lossPct);
      m.style.cssText = `background:${bg};color:${readableOn(bg)};padding:2px 8px;border-radius:999px;font:600 12px Inter,sans-serif`;
      new maplibregl.Marker({ element: m }).setLngLat([c.lng, c.lat]).setPopup(new maplibregl.Popup().setText(`${c.name}: ${inr(c.lossRs)} (${pct(c.lossPct)})`)).addTo(map);
      bounds.extend([c.lng, c.lat]);
    });
    if (centres.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 10 });
    return () => map.remove();
  }, [centres]);
  return <div ref={el} role="region" aria-label="Centre map" className="h-64 w-full overflow-hidden rounded-xl border border-line" data-testid="centre-map" />;
}
