import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { forgetPassword } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await forgetPassword({
          email: value.email,
          redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
        });
      } catch {
        // Silently ignore — no email enumeration
      }
      setSubmitted(true);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-6xl text-primary leading-none arena-glow">
              PGT
            </h1>
            <div className="h-1 w-16 bg-primary mx-auto mt-4 rounded-sm" />
            <p className="font-heading text-muted-foreground uppercase tracking-wider text-sm mt-4">
              {t('auth.forgotPasswordTitle')}
            </p>
          </div>

          {submitted ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t('auth.forgotPasswordSuccess')}</p>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 transition-colors no-underline text-sm"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
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
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={t('auth.email')}
                        required
                      />
                    </div>
                  )}
                </form.Field>

                <Button type="submit" className="w-full">
                  {t('auth.forgotPasswordSubmit')}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm">
                <Link
                  to="/login"
                  className="text-muted-foreground hover:text-primary transition-colors no-underline"
                >
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
