import { useEffect, useState } from 'react';
export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const u = () => setOn(true), d = () => setOn(false); addEventListener('online', u); addEventListener('offline', d); return () => { removeEventListener('online', u); removeEventListener('offline', d); }; }, []);
  return on;
}
