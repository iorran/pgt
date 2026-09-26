import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { NotificationBell } from '@/components/notification-bell';
import { NavLinks } from './sidebar';

export function Header() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-2 px-4 md:px-6 py-2 bg-sidebar border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t('nav.menu')}
        onClick={() => setMenuOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="px-4 py-6">
          <SheetTitle className="font-display text-4xl text-primary leading-none">PGT</SheetTitle>
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="hidden md:block" />

      <div className="flex items-center gap-1 md:gap-3">
        <NotificationBell />
        <div className="flex items-center" role="group" aria-label={t('me.language')}>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={i18n.language === 'pt-BR'}
            className={i18n.language === 'pt-BR' ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => i18n.changeLanguage('pt-BR')}
          >
            PT
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={i18n.language === 'en'}
            className={i18n.language === 'en' ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </Button>
        </div>

        <Separator orientation="vertical" className="hidden md:block h-5" />

        <span className="hidden md:inline font-heading text-sm text-foreground">
          {session?.user?.name}
        </span>

        <Button variant="outline" onClick={() => signOut()}>
          {t('auth.logout')}
        </Button>
      </div>
    </header>
  );
}
