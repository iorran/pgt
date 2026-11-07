import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudentHeader } from './student-header';
import { StudentBottomNav } from './student-bottom-nav';
import { StudentPaymentBanner } from '../student-payment-banner';

export function StudentShell() {
  const location = useLocation();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {t('common.skipToContent')}
      </a>
      <StudentHeader />
      <StudentPaymentBanner />
      <main
        key={location.pathname}
        id="main"
        tabIndex={-1}
        className="pgt-page-enter flex-1 px-4 py-4 outline-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
      >
        <Outlet />
      </main>
      <StudentBottomNav />
    </div>
  );
}
