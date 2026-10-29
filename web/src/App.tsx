import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './lib/auth.tsx';
import Login from './pages/Login.tsx';
import Home from './pages/Home.tsx';
import NewLot from './pages/NewLot.tsx';
import Scan from './pages/Scan.tsx';
import LotPage from './pages/LotPage.tsx';
import Queue from './pages/Queue.tsx';

const Account = lazy(() => import('./pages/Account.tsx'));
const PublicReport = lazy(() => import('./pages/PublicReport.tsx'));
const Overview = lazy(() => import('./pages/manager/Overview.tsx'));
const LotsList = lazy(() => import('./pages/manager/LotsList.tsx'));
const LotDetail = lazy(() => import('./pages/manager/LotDetail.tsx'));
const AlertsPage = lazy(() => import('./pages/manager/AlertsPage.tsx'));
const Settings = lazy(() => import('./pages/manager/Settings.tsx'));

function RequireManager({ children }: { children: ReactNode }) { const { profile } = useAuth(); return profile?.role === 'manager' ? <>{children}</> : <Navigate to="/" replace />; }
function AccessBlocked() {
  const { t } = useTranslation(); const { signOut } = useAuth();
  return <div className="mx-auto max-w-md space-y-4 p-6 text-center" role="alert" data-testid="access-blocked"><h1 className="text-xl font-extrabold">{t('accessBlockedTitle')}</h1><p>{t('accessBlockedBody')}</p><button className="btn" onClick={() => void signOut()}>{t('signOut')}</button></div>;
}
function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, signedIn, profile, profileMissing } = useAuth(); const { t } = useTranslation();
  if (loading) return <p className="p-6 text-center">{t('loading')}</p>;
  if (!signedIn) return <Navigate to="/login" replace />;
  if (!profile && profileMissing) return <AccessBlocked />;
  if (!profile) return <p className="p-6 text-center">{t('loading')}</p>;
  return <>{children}</>;
}
const guard = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;
const mgr = (el: ReactNode) => <RequireAuth><RequireManager>{el}</RequireManager></RequireAuth>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<p className="p-6 text-center">…</p>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={guard(<Home />)} />
            <Route path="/lot/new" element={guard(<NewLot />)} />
            <Route path="/scan" element={guard(<Scan />)} />
            <Route path="/l/:code" element={guard(<LotPage />)} />
            <Route path="/r/:token" element={<PublicReport />} />
            <Route path="/m" element={mgr(<Overview />)} />
            <Route path="/m/lots" element={mgr(<LotsList />)} />
            <Route path="/m/lot/:code" element={mgr(<LotDetail />)} />
            <Route path="/m/alerts" element={mgr(<AlertsPage />)} />
            <Route path="/m/settings" element={mgr(<Settings />)} />
            <Route path="/account" element={guard(<Account />)} />
            <Route path="/queue" element={guard(<Queue />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
