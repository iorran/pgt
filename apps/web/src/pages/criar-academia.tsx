import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      academyName: '',
      city: '',
    },
    onSubmit: async ({ value }) => {
      setError('');
      setLoading(true);

      try {
        if (!isLoggedIn) {
          const { error } = await signUp.email({
            name: value.name,
            email: value.email,
            password: value.password,
            role: 'owner',
          } as any);
          if (error) {
            setError(error.message ?? 'Signup failed');
            return;
          }
        }

        await api('/academies', {
          method: 'POST',
          body: JSON.stringify({ name: value.academyName, city: value.city }),
        });

        window.location.href = '/';
      } catch (err: any) {
        setError(err.message ?? 'Signup failed');
      } finally {
        setLoading(false);
      }
    },
  });

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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            {!isLoggedIn && (
              <>
                <div>
                  <h2 className="font-heading text-lg uppercase tracking-wide text-foreground mb-4">
                    {t('onboarding.yourData')}
                  </h2>
                  <div className="space-y-4">
                    <form.Field name="name">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="name">{t('auth.name')}</Label>
                          <Input
                            id="name"
                            type="text"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder={t('auth.name')}
                            required
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="email">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('auth.email')}</Label>
                          <Input
                            id="email"
                            type="email"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder={t('auth.email')}
                            required
                          />
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="password">
                      {(field) => (
                        <div className="space-y-2">
                          <Label htmlFor="password">{t('auth.password')}</Label>
                          <Input
                            id="password"
                            type="password"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder={t('auth.password')}
                            required
                          />
                        </div>
                      )}
                    </form.Field>
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
                <form.Field name="academyName">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="academyName">{t('onboarding.academyName')}</Label>
                      <Input
                        id="academyName"
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={t('onboarding.academyName')}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="city">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="city">{t('onboarding.city')}</Label>
                      <Input
                        id="city"
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={t('onboarding.city')}
                        required
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {t('onboarding.createAcademy')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
