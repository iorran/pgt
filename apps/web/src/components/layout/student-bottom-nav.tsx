import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, Trophy, QrCode, ShoppingBag, User } from 'lucide-react';

type Tab = {
  to: string;
  labelKey: string;
  Icon: typeof Calendar;
  // Path prefixes that belong to this tab (sub-pages keep it highlighted).
  match: string[];
};

const LEFT_TABS: Tab[] = [
  { to: '/classes', labelKey: 'nav.classes', Icon: Calendar, match: ['/classes'] },
  { to: '/gamification/profile', labelKey: 'nav.progress', Icon: Trophy, match: ['/gamification'] },
];

const RIGHT_TABS: Tab[] = [
  { to: '/marketplace', labelKey: 'nav.shop', Icon: ShoppingBag, match: ['/marketplace'] },
  // Tournaments and settings are reached from the Me hub.
  { to: '/me', labelKey: 'nav.me', Icon: User, match: ['/me', '/tournaments', '/settings'] },
];

function TabLink({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { Icon } = tab;
  const isActive = tab.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <Link
      to={tab.to}
      aria-label={t(tab.labelKey)}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px]',
        'text-xs font-heading uppercase tracking-wide',
        'transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]',
        isActive
          ? 'text-[color:var(--pgt-green)]'
          : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span>{t(tab.labelKey)}</span>
      {isActive ? (
        <span className="h-1 w-1 rounded-full bg-[color:var(--pgt-green)]" />
      ) : null}
    </Link>
  );
}

export function StudentBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label="Student bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-between border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex flex-1 items-stretch">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </div>

      <NavLink
        to="/checkin"
        aria-label={t('nav.checkin')}
        className="relative -top-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--pgt-green)] to-[color:var(--pgt-gold)] text-white shadow-lg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-spring)] active:scale-[0.92]"
      >
        <QrCode className="h-7 w-7" aria-hidden />
      </NavLink>

      <div className="flex flex-1 items-stretch">
        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  );
}
