import { Outlet, useLocation } from 'react-router-dom';
import { StudentHeader } from './student-header';
import { StudentBottomNav } from './student-bottom-nav';

export function StudentShell() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StudentHeader />
      <main
        key={location.pathname}
        className="pgt-page-enter flex-1 px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
      >
        <Outlet />
      </main>
      <StudentBottomNav />
    </div>
  );
}
