import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center arena-stripes px-4">
      <div className="text-center mb-10">
        <h1 className="font-display text-6xl text-primary leading-none arena-glow">
          PGT
        </h1>
        <div className="h-1 w-16 bg-primary mx-auto mt-4 rounded-sm" />
        <p className="font-heading text-muted-foreground uppercase tracking-wider text-sm mt-4">
          {t('app.tagline')}
        </p>
      </div>

      <p className="font-heading text-xl text-foreground uppercase tracking-wide mb-6">
        {t('onboarding.chooseRole')}
      </p>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
        <Card className="flex-1 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {t('onboarding.createAcademy')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('onboarding.createAcademyDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/criar-academia')}>
              {t('onboarding.createAcademy')}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex-1 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {t('onboarding.haveCode')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('onboarding.haveCodeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={t('onboarding.enterCode')}
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!code.trim()}
              onClick={() => navigate(`/entrar/${code.trim()}`)}
            >
              {t('onboarding.continue')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link
          to="/login"
          className="text-muted-foreground hover:text-primary transition-colors no-underline"
        >
          {t('auth.login')}
        </Link>
      </p>
    </div>
  );
}
