import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NotificationBell } from '@/components/notification-bell';
import { HelpLink } from '@/components/help-link';

// Shared by the desktop header and the mobile "More" sheet.
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className={`items-center ${className ?? 'flex'}`} role="group" aria-label={t('me.language')}>
      {(['pt-BR', 'en'] as const).map((lng) => (
        <Button
          key={lng}
          variant="ghost"
          size="icon"
          aria-pressed={i18n.language === lng}
          className={i18n.language === lng ? 'text-primary' : 'text-muted-foreground'}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {lng === 'en' ? 'EN' : 'PT'}
        </Button>
      ))}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 md:px-6 py-2 bg-sidebar border-b border-border">
      <span className="md:hidden font-display text-3xl text-primary leading-none">PGT</span>
      <div className="hidden md:block" />

      <div className="flex items-center gap-1 md:gap-3">
        <HelpLink guide="owner" className="text-muted-foreground hover:text-foreground" />
        <NotificationBell />
        <LanguageSwitch className="hidden md:flex" />

        <Separator orientation="vertical" className="hidden md:block h-5" />

        <span className="hidden md:inline font-heading text-sm text-foreground">
          {session?.user?.name}
        </span>

        <Button variant="outline" className="hidden md:inline-flex" onClick={() => signOut()}>
          {t('auth.logout')}
        </Button>
      </div>
    </header>
  );
}
