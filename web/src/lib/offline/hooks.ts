import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './db.ts';
import { pendingCount } from './outbox.ts';

/** Number of this person's items still waiting to upload (live). */
export function usePendingCount(userId: string | undefined) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const sub = liveQuery(() => pendingCount(db, userId)).subscribe({ next: setN, error: () => undefined });
    return () => sub.unsubscribe();
  }, [userId]);
  return n;
}
