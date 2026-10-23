import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { Shell } from '../components/Shell.tsx';
import { Timeline, type TimelineItem } from '../components/Timeline.tsx';
import { CheckpointForm } from '../components/CheckpointForm.tsx';
import { QrCard } from '../components/QrCard.tsx';
import { fetchCheckpoints, fetchLotByCode, fetchRecentLots } from '../lib/api.ts';
import { loadMasterCached } from '../lib/master.ts';
import { db } from '../lib/offline/db.ts';
import { isLotId } from '../lib/lotCode.ts';
import type { Lot } from '../lib/db.ts';
import type { MasterData } from '../lib/api.ts';

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export default function LotPage() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const [lot, setLot] = useState<Lot | null | undefined>(undefined);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const m = await loadMasterCached(); setMaster(m);
    const key = decodeURIComponent(code);
    let found: Lot | null = null;
    // a lot created on this phone and not yet uploaded
    const q = (await db.lots.toArray()).find((x) => x.row.id === key || x.row.short_code.toUpperCase() === key.toUpperCase());
    if (q && m) found = { id: q.row.id, short_code: q.row.short_code, qr_code: q.row.qr_code, crate_count: q.row.crate_count, status: 'open', created_at: new Date(q.createdAt).toISOString(), farmer: m.farmers.find((f) => f.id === q.row.farmer_id) ?? null, crop: m.crops.find((c) => c.id === q.row.crop_id) ?? null };
    if (!found && navigator.onLine) {
      try {
        found = await withTimeout(fetchLotByCode(key), 6000);
        void withTimeout(fetchRecentLots(), 8000).then((ls) => db.lotCache.bulkPut(ls.map((l) => ({ id: l.id, short_code: l.short_code, data: l })))).catch(() => undefined);
      } catch { /* fall back to the offline copy */ }
    }
    if (!found) { const c = isLotId(key) ? await db.lotCache.get(key) : await db.lotCache.where('short_code').equalsIgnoreCase(key).first(); found = (c?.data as Lot) ?? null; }
    setLot(found);
    if (!found) return;
    let remote: TimelineItem[] = [];
    if (navigator.onLine) { try { remote = await withTimeout(fetchCheckpoints(found.id), 6000); } catch { /* offline */ } }
    const local = (await db.checkpoints.toArray()).filter((c) => c.row.lot_id === found!.id && !remote.some((r) => r.id === c.row.id)).map((c) => ({ ...(c.row as unknown as TimelineItem), flags: [], offline_synced: false, pending: true }));
    setItems([...remote, ...local].sort((a, b) => a.device_captured_at.localeCompare(b.device_captured_at)));
  }, [code]);
  useEffect(() => { void load(); }, [load]);

  if (lot === undefined) return <Shell back="/"><p className="text-muted">{t('loading')}</p></Shell>;
  if (lot === null) return <Shell back="/"><p role="alert" className="text-danger" data-testid="lot-not-found">{t('lotNotFound')}</p></Shell>;
  const last = items.at(-1)?.stage ?? null;
  return (
    <Shell title={lot.short_code} back="/">
      <div className="card text-sm" data-testid="lot-summary"><b>{lot.crop?.name}</b> · {lot.farmer?.name}, {lot.farmer?.village}{lot.crate_count ? ` · ${lot.crate_count} ${t('crates')}` : ''}</div>
      <Timeline items={items} centres={master?.centres ?? []} />
      {adding && master && profile ? (
        <CheckpointForm lotId={lot.id} lotLabel={lot.short_code} lastStage={last} centres={master.centres} transporters={master.transporters} defaultCrates={lot.crate_count} onSaved={() => { setAdding(false); void load(); }} />
      ) : <button className="btn btn-primary" onClick={() => setAdding(true)} data-testid="add-checkpoint">{t('addCheckpoint')}</button>}
      <QrCard lotId={lot.id} shortCode={lot.short_code} cropName={lot.crop?.name ?? ''} />
    </Shell>
  );
}
