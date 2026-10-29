import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';
import { Shell } from '../components/Shell.tsx';

export default function Home() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [params] = useSearchParams();
  if (profile?.role === 'manager' && !params.get('field')) return <Navigate to="/m" replace />;
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">{t('hello', { name: profile?.name })}</h1>
      <Link to="/lot/new" className="btn btn-primary !min-h-16 text-xl" data-testid="home-new-lot">➕ {t('newLot')}</Link>
      <Link to="/scan" className="btn !min-h-16 text-xl" data-testid="home-scan">▦ {t('scanLot')}</Link>
    </Shell>
  );
}
