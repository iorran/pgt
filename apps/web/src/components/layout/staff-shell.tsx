import { Suspense } from 'react';
import { PageLoader } from '@/components/page-loader';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { StaffBottomNav } from './staff-bottom-nav';

export function StaffShell() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 p-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:p-6 arena-stripes outline-none">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <StaffBottomNav />
    </div>
  );
}
