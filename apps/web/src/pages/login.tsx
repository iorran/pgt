import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { signIn } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  function safeRedirect(raw: string | null): string {
    if (!raw) return '/';
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
      return '/';
    }
    return raw;
  }

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError('');
      const result = await signIn.email({ email: value.email, password: value.password });
      if (result.error) {
        setError(t('auth.loginError'));
      } else {
        navigate(safeRedirect(searchParams.get('redirect')));
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
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
            className="space-y-4"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={!!error || undefined}
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
                    autoComplete="current-password"
                    aria-invalid={!!error || undefined}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('auth.password')}
                    required
                  />
                </div>
              )}
            </form.Field>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  {t('auth.login')}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link
              to="/signup"
              className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline"
            >
              {t('auth.signup')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
