import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Header() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0f0f0f] border-b border-border">
      <div />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant={i18n.language === 'pt-BR' ? 'ghost' : 'ghost'}
            size="xs"
            className={i18n.language === 'pt-BR' ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => i18n.changeLanguage('pt-BR')}
          >
            PT
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={i18n.language === 'en' ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </Button>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <span className="font-heading text-sm text-foreground">
          {session?.user?.name}
        </span>

        <Button variant="outline" size="sm" onClick={() => signOut()}>
          {t('auth.logout')}
        </Button>
      </div>
    </header>
  );
}
