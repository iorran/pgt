import { useState } from 'react';
import { resetPassword } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPass !== confirmPass) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }

    try {
      await resetPassword({ newPassword: newPass, token });
      setSuccess(true);
    } catch {
      setError(t('auth.resetPasswordError'));
    }
  }

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
              {t('auth.resetPasswordTitle')}
            </p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t('auth.resetPasswordSuccess')}</p>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 transition-colors no-underline text-sm"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder={t('auth.newPassword')}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  {error === t('auth.resetPasswordError') && (
                    <Link
                      to="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors no-underline"
                    >
                      {t('auth.requestNewReset')}
                    </Link>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full">
                {t('auth.resetPasswordSubmit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
