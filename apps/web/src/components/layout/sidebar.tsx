import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { isOwner } from '@/lib/roles';

// Shared by the desktop sidebar and the mobile menu sheet.
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const showStaff = isOwner(session?.user as any);

  const navItems = [
    { to: '/', label: t('nav.dashboard'), show: true },
    { to: '/classes', label: t('nav.classes'), show: true },
    { to: '/students', label: t('nav.students'), show: showStaff },
    { to: '/billing', label: t('nav.billing'), show: showStaff },
    { to: '/marketplace', label: t('nav.marketplace'), show: true },
    { to: '/gamification', label: t('nav.gamification'), show: true },
    { to: '/tournaments', label: t('nav.tournaments'), show: true },
    { to: '/settings', label: t('nav.settings'), show: showStaff },
    { to: '/totem', label: t('nav.totem'), show: showStaff },
  ];

  return (
    <div className="flex flex-col gap-0.5 flex-1">
      {navItems.filter(i => i.show).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center min-h-11 px-3 font-heading uppercase text-sm tracking-wide rounded-sm no-underline transition-colors ${
              isActive
                ? 'bg-muted border-l-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <nav className="hidden md:flex w-[220px] shrink-0 flex-col bg-sidebar min-h-dvh border-r border-border px-4 py-6">
      <div className="mb-6">
        <h2 className="font-display text-4xl text-primary leading-none">PGT</h2>
        <p className="text-xs text-muted-foreground mt-1">{t('app.tagline')}</p>
        <div className="h-1 w-12 bg-primary mt-3 rounded-sm" />
      </div>

      <NavLinks />

      <div className="mt-auto">
        <Separator className="mb-3" />
        <p className="text-xs text-muted-foreground">
          v{__APP_VERSION__} &middot; {new Date((__BUILD_TIME__ as string)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </nav>
  );
}
