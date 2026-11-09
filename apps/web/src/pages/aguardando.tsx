import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AguardandoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-dvh flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">
            PGT
          </h1>
          <div className="h-1 w-12 bg-primary mx-auto rounded-sm" />

          <Hourglass className="size-10 mx-auto text-muted-foreground" aria-hidden="true" />

          <h2 className="font-heading text-2xl text-foreground uppercase">
            {t('onboarding.waitingTitle')}
          </h2>

          <p className="text-muted-foreground">
            {t('onboarding.waitingMessage')}
          </p>

          <div className="text-left space-y-2">
            <h3 className="font-heading text-sm uppercase text-foreground">
              {t('firstAccess.nextTitle')}
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('firstAccess.nextApprove')}</li>
              <li>{t('firstAccess.nextRefresh')}</li>
              <li>{t('firstAccess.nextCheckin')}</li>
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              {t('onboarding.waitingRefresh')}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignOut}
            >
              {t('auth.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
