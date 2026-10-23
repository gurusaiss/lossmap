import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ManagerShell } from '../../components/manager/ManagerShell.tsx';
import { supabase } from '../../lib/supabase.ts';

interface Row { id: string; short_code: string; status: string; created_at: string; farmer: { name: string; village: string } | null; crop: { name: string } | null }
export default function LotsList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null); const [q, setQ] = useState('');
  useEffect(() => { void supabase.from('lots').select('id, short_code, status, created_at, farmer:farmers(name, village), crop:crops(name)').order('created_at', { ascending: false }).limit(300).then(({ data }) => setRows((data ?? []) as unknown as Row[])); }, []);
  const shown = useMemo(() => (rows ?? []).filter((r) => `${r.short_code} ${r.farmer?.name} ${r.farmer?.village}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  return (
    <ManagerShell>
      <h1 className="text-xl font-extrabold">{t('mgr_lots')}</h1>
      <input className="input" placeholder={t('search')} aria-label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="lots-search" />
      {!rows && <p className="text-muted">{t('loading')}</p>}
      <table className="w-full text-sm" data-testid="lots-table"><thead><tr className="text-left text-muted"><th>{t('lot')}</th><th>{t('farmer')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{shown.map((r) => <tr key={r.id} className="border-t border-line"><td className="py-2"><Link className="font-semibold underline" to={`/m/lot/${r.short_code}`}>{r.short_code}</Link></td><td>{r.farmer?.name}, {r.farmer?.village}</td><td>{t(`status_${r.status}`)}</td></tr>)}</tbody></table>
    </ManagerShell>
  );
}
