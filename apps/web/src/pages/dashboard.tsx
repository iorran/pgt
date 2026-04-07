import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  joinCode: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isInstructor = user?.role === 'instructor';
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const [locationMsg, setLocationMsg] = useState('');

  const { data: academy } = useApiQuery<AcademyInfo>(
    ['academy-mine'],
    '/academies/mine',
    !!user?.academyId,
  );

  function handleCopy() {
    if (!academy) return;
    navigator.clipboard.writeText(academy.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSetLocation() {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await api(`/academies/${academy!.id}/location`, {
          method: 'PUT',
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ['academy-mine'] });
        setLocationMsg(t('onboarding.locationSet'));
        setTimeout(() => setLocationMsg(''), 3000);
      },
      () => {
        setLocationMsg('Geolocation unavailable');
        setTimeout(() => setLocationMsg(''), 3000);
      },
    );
  }

  function handleShareWhatsApp() {
    if (!academy) return;
    const message = `${t('onboarding.shareMessage')} ${window.location.origin}/entrar/${academy.joinCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.dashboard')}
      </h1>

      <p className="text-muted-foreground">
        {t('common.loading').replace('...', '')}, {user?.name}
      </p>

      {isInstructor && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {academy.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('onboarding.joinCode')}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl bg-secondary p-4 rounded-sm flex-1 text-center">
                  {academy.joinCode}
                </span>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? t('onboarding.copied') : t('onboarding.copyCode')}
                </Button>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleShareWhatsApp}>
              {t('onboarding.shareWhatsApp')}
            </Button>

            <div className="border-t border-border pt-4 mt-4">
              <p className="font-heading uppercase tracking-wider text-sm mb-3">
                {t('onboarding.setLocation')}
              </p>

              {academy.address && (
                <p className="text-sm text-muted-foreground mb-2">{academy.address}</p>
              )}

              {academy.latitude && (
                <p className="text-xs text-muted-foreground mb-3">
                  {academy.latitude}, {academy.longitude}
                </p>
              )}

              <Button variant="outline" className="w-full" onClick={handleSetLocation}>
                {t('onboarding.useMyLocation')}
              </Button>

              {locationMsg && (
                <p className="text-primary text-sm mt-2">{locationMsg}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="font-mono text-3xl text-primary arena-stat">--</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('nav.students')}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="font-mono text-3xl text-primary arena-stat">--</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('nav.classes')}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="font-mono text-3xl text-primary arena-stat">--</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('nav.tournaments')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
