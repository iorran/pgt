import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await signIn.email({ email, password });
    if (error) setError(error.message);
    else navigate('/');
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
              {t('app.tagline')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full">
              {t('auth.login')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link
              to="/signup"
              className="text-muted-foreground hover:text-primary transition-colors no-underline"
            >
              {t('auth.signup')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
