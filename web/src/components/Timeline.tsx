import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signedPhotoUrl } from '../lib/api.ts';
import type { Centre, Checkpoint } from '../lib/db.ts';

export interface TimelineItem extends Checkpoint { pending?: boolean }
function Photo({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (url) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="h-24 rounded-lg border border-line" /></a>;
  return <button className="rounded-lg border border-line px-2 py-1 text-xs underline" onClick={() => void signedPhotoUrl(path).then((u) => (u ? setUrl(u) : setFailed(true)))}>{failed ? '—' : label}</button>;
}

export function Timeline({ items, centres }: { items: TimelineItem[]; centres: Centre[] }) {
  const { t } = useTranslation();
  return (
    <ol className="space-y-2" data-testid="timeline">
      {items.map((c) => (
        <li key={c.id} className="card space-y-1" data-testid="timeline-item">
          <div className="flex items-center justify-between gap-2"><b>{t(`stage_${c.stage}`)}</b><time className="text-xs text-muted">{new Date(c.device_captured_at).toLocaleString()}</time></div>
          <div className="text-sm">{c.weight_kg} kg{c.centre_id ? ` · ${centres.find((x) => x.id === c.centre_id)?.name ?? ''}` : ''}</div>
          {c.quality_good_pct !== null && <div className="text-sm text-muted">{t('good')} {c.quality_good_pct}% · {t('damaged')} {c.quality_damaged_pct}% · {t('rotten')} {c.quality_rotten_pct}%</div>}
          <div className="flex flex-wrap gap-1">
            {c.pending && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn" data-testid="pending-flag">{t('waitingUpload')}</span>}
            {!c.pending && c.offline_synced && <span className="rounded-full bg-line px-2 py-0.5 text-xs">{t('syncedOffline')}</span>}
            {c.weight_source !== 'manual' && <span className="rounded-full bg-line px-2 py-0.5 text-xs">{t(`source_${c.weight_source}`)}</span>}
            {c.flags.map((f) => <span key={f} className="rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn">{t(`flag_${f}`, f)}</span>)}
          </div>
          {!c.pending && <div className="flex gap-2">{c.scale_photo_url && <Photo path={c.scale_photo_url} label={t('scalePhoto')} />}{c.produce_photo_url && <Photo path={c.produce_photo_url} label={t('producePhoto')} />}</div>}
        </li>
      ))}
    </ol>
  );
}
