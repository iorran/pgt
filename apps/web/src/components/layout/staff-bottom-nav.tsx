import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, LayoutDashboard, Menu, Users, Wallet } from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { NavLinks } from './sidebar';
import { LanguageSwitch } from './header';

const TABS = [
  { to: '/', labelKey: 'nav.dashboard', Icon: LayoutDashboard },
  { to: '/classes', labelKey: 'nav.classes', Icon: Calendar },
  { to: '/students', labelKey: 'nav.students', Icon: Users },
  { to: '/billing', labelKey: 'nav.billing', Icon: Wallet },
];

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-1 min-h-14 text-xs font-heading uppercase tracking-wide transition-colors ${
    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`;

export function StaffBottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label={t('nav.staffBottom')}
      className="md:hidden fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, labelKey, Icon }) => {
        const active = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            <Icon className="size-5" aria-hidden />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(false)}>
        <Menu className="size-5" aria-hidden />
        <span>{t('nav.more')}</span>
      </button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="flex flex-col gap-4 px-4 py-6">
          <SheetTitle className="font-heading text-lg uppercase">{session?.user?.name}</SheetTitle>
          <NavLinks onNavigate={() => setMoreOpen(false)} />
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <LanguageSwitch />
            <Button variant="outline" onClick={() => signOut()}>
              {t('auth.logout')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
