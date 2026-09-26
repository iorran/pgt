import { useState, useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { signUp } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { beltKey } from '@/lib/belts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Academy {
  id: string;
  name: string;
  city: string;
}

export default function EntrarPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    api<Academy>(`/academies/by-code/${code}`)
      .then(data => {
        setAcademy(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        // api() only surfaces the server's message; 'Academy not found' is the 404 body.
        setLoadError(
          err.message === 'Academy not found' ? 'onboarding.academyNotFound' : 'common.genericError',
        );
        setLoading(false);
      });
  }, [code]);

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      belt: 'white',
    },
    onSubmit: async ({ value }) => {
      if (!academy) return;
      setError('');

      try {
        // Signup with academyId — databaseHook sets status to 'pending' automatically
        const { error } = await signUp.email({
          name: value.name,
          email: value.email,
          password: value.password,
          belt: value.belt,
          role: 'student',
          academyId: academy.id,
        } as any);
        if (error) {
          setError(t('common.genericError'));
          return;
        }

        // Force full reload so session reflects the pending status
        window.location.href = '/aguardando';
      } catch {
        setError(t('common.genericError'));
      }
    },
  });

  if (loading) {
    return (
      <div
        role="status"
        className="min-h-screen flex items-center justify-center gap-2 arena-stripes text-muted-foreground"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <h1 className="font-display text-6xl text-primary leading-none arena-glow mb-6">
              PGT
            </h1>
            <p role="alert" className="text-destructive font-heading text-lg">
              {t(loadError)}
            </p>
            <Link to="/signup" className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline mt-4">
              {t('common.back')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-lg bg-card border-border">
        <CardHeader className="text-center">
          <h1 className="font-display text-5xl text-primary leading-none arena-glow mb-4">
            PGT
          </h1>
          <div className="h-1 w-16 bg-primary mx-auto rounded-sm" />
          <CardTitle className="font-heading text-2xl uppercase mt-4">
            {academy?.name}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {academy?.city}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.name')}</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
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
                    inputMode="email"
                    autoComplete="email"
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
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="password-hint"
                  />
                  <p id="password-hint" className="text-xs text-muted-foreground">
                    {t('auth.passwordHint')}
                  </p>
                </div>
              )}
            </form.Field>

            <form.Field name="belt">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="belt">{t('onboarding.belt')}</Label>
                  <select
                    id="belt"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="bg-secondary border border-border text-foreground rounded-sm px-2.5 min-h-11 w-full font-body"
                  >
                    {['white', 'blue', 'purple', 'brown', 'black'].map((b) => (
                      <option key={b} value={b}>
                        {t(beltKey(b))}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  {t('onboarding.continue')}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="mt-6 flex justify-between text-sm">
            <Link to="/signup" className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline">
              {t('common.back')}
            </Link>
            <Link to="/login" className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline">
              {t('auth.haveAccount')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
