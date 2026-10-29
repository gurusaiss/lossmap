import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth.tsx';

/** A manager hands out a temporary password; until the person picks their own, remind them (not on the Account page itself). */
export function TempPasswordBanner() {
  const { t } = useTranslation();
  const { session, orgIsDemo } = useAuth();
  const { pathname } = useLocation();
  if (orgIsDemo || pathname === '/account' || session?.user.user_metadata?.temp_password !== true) return null;
  return <Link to="/account" className="block rounded-lg border border-warn bg-warn/10 p-3 text-sm font-semibold text-warn" data-testid="temp-password-banner">{t('tempPasswordBanner')}</Link>;
}
