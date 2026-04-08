import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';

export function Sidebar() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const location = useLocation();
  const isInstructor = (session?.user as any)?.role === 'instructor';

  const navItems = [
    { to: '/', label: t('nav.dashboard'), show: true },
    { to: '/classes', label: t('nav.classes'), show: true },
    { to: '/students', label: t('nav.students'), show: isInstructor },
    { to: '/pending', label: t('onboarding.pendingStudents'), show: isInstructor },
    { to: '/billing', label: t('nav.billing'), show: isInstructor },
    { to: '/marketplace', label: t('nav.marketplace'), show: true },
    { to: '/gamification', label: t('nav.gamification'), show: true },
    { to: '/tournaments', label: t('nav.tournaments'), show: true },
    { to: '/settings', label: t('nav.settings'), show: isInstructor },
  ];

  return (
    <nav className="flex w-[220px] flex-col bg-[#0f0f0f] min-h-screen border-r border-border px-4 py-6">
      <div className="mb-6">
        <h2 className="font-display text-4xl text-primary leading-none">PGT</h2>
        <p className="text-xs text-muted-foreground mt-1">{t('app.tagline')}</p>
        <div className="h-1 w-12 bg-primary mt-3 rounded-sm" />
      </div>

      <div className="flex flex-col gap-0.5 flex-1">
        {navItems.filter(i => i.show).map(item => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`block px-3 py-2 font-heading uppercase text-sm tracking-wide rounded-sm no-underline transition-colors ${
                isActive
                  ? 'bg-[#1a1a1a] border-l-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#141414]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto">
        <Separator className="mb-3" />
        <p className="text-[10px] text-muted-foreground">
          v0.0.1 &middot; {new Date((__BUILD_TIME__ as string)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </nav>
  );
}
