import { useState } from 'react';
import { signUp, useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function CriarAcademiaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isLoggedIn = !!session;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!isLoggedIn) {
        const { error } = await signUp.email({ name, email, password, role: 'instructor' } as any);
        if (error) {
          setError(error.message ?? 'Signup failed');
          return;
        }
      }

      await api('/academies', {
        method: 'POST',
        body: JSON.stringify({ name: academyName, city }),
      });

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-lg bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-6xl text-primary leading-none arena-glow">
              PGT
            </h1>
            <div className="h-1 w-16 bg-primary mx-auto mt-4 rounded-sm" />
            <p className="font-heading text-muted-foreground uppercase tracking-wider text-sm mt-4">
              {t('app.tagline')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLoggedIn && (
              <>
                <div>
                  <h2 className="font-heading text-lg uppercase tracking-wide text-foreground mb-4">
                    {t('onboarding.yourData')}
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('auth.name')}</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('auth.name')}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('auth.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('auth.email')}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">{t('auth.password')}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('auth.password')}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            <div>
              <h2 className="font-heading text-lg uppercase tracking-wide text-foreground mb-4">
                {t('onboarding.yourAcademy')}
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="academyName">{t('onboarding.academyName')}</Label>
                  <Input
                    id="academyName"
                    type="text"
                    value={academyName}
                    onChange={e => setAcademyName(e.target.value)}
                    placeholder={t('onboarding.academyName')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('onboarding.city')}</Label>
                  <Input
                    id="city"
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder={t('onboarding.city')}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('onboarding.creating') : t('onboarding.createAcademy')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
