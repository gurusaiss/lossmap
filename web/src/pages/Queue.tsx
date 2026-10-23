import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { Shell } from '../components/Shell.tsx';
import { db } from '../lib/offline/db.ts';
import { discardItem, listQueue, retryItem } from '../lib/offline/outbox.ts';
import { triggerSync } from '../lib/offline/loop.ts';

export default function Queue() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listQueue>>>([]);
  useEffect(() => { if (!profile) return; const s = liveQuery(() => listQueue(db, profile.user_id)).subscribe({ next: setRows }); return () => s.unsubscribe(); }, [profile]);
  return (
    <Shell title={t('queueTitle')} back="/">
      <p className="text-sm text-muted">{t('queueUserNote')}</p>
      <button className="btn" onClick={() => void triggerSync()} data-testid="sync-now">{t('syncNow')}</button>
      {rows.length === 0 && <p data-testid="queue-empty">{t('queueEmpty')}</p>}
      <ul className="space-y-2" data-testid="queue-list">
        {rows.map(({ kind, item }) => (
          <li key={item.id} className="card space-y-1" data-testid="queue-item">
            <div className="font-semibold">{t(`queue_${kind}`)}{kind === 'checkpoint' ? ` · ${(item as { lotLabel: string }).lotLabel}` : ''}</div>
            <div className="text-sm text-muted">{item.status === 'rejected' ? `${t('rejected')}: ${item.error ?? ''}` : t('waitingUpload')}</div>
            {item.status === 'rejected' && <div className="grid grid-cols-2 gap-2"><button className="btn !min-h-10" onClick={() => void retryItem(db, kind, item.id).then(triggerSync)}>{t('retry')}</button><button className="btn !min-h-10" onClick={() => void discardItem(db, kind, item.id)}>{t('discard')}</button></div>}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
