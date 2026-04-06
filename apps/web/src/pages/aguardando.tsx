import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">
            PGT
          </h1>
          <div className="h-1 w-12 bg-primary mx-auto rounded-sm" />

          <p className="font-mono text-4xl text-muted-foreground">&#9203;</p>

          <h2 className="font-heading text-2xl text-foreground uppercase">
            {t('onboarding.waitingTitle')}
          </h2>

          <p className="text-muted-foreground">
            {t('onboarding.waitingMessage')}
          </p>

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
              size="sm"
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
