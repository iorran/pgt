import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { useApiQuery } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  joinCode: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isOwnerUser = isOwner(user);
  const queryClient = useQueryClient();
  const [locationMsg, setLocationMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: academy } = useApiQuery<AcademyInfo>(
    ['academy-mine'],
    '/academies/mine',
    !!user?.academyId,
  );

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
        setLocationMsg(t('settings.geolocationUnavailable'));
        setTimeout(() => setLocationMsg(''), 3000);
      },
    );
  }

  function handleCopy() {
    if (!academy) { return; }
    navigator.clipboard.writeText(academy.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareWhatsApp() {
    if (!academy) { return; }
    const message = `${t('onboarding.shareMessage')} ${window.location.origin}/entrar/${academy.joinCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.settings')}
      </h1>

      {isOwnerUser && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-lg uppercase">
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
          </CardContent>
        </Card>
      )}

      {isOwnerUser && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
              <MapPin size={20} className="text-primary" />
              {t('onboarding.setLocation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {academy.latitude ? (
              <div className="space-y-1">
                {academy.address && (
                  <p className="text-sm text-foreground">{academy.address}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {academy.latitude}, {academy.longitude}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('onboarding.locationNotSet')}
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={handleSetLocation}>
              {t('onboarding.useMyLocation')}
            </Button>
            {locationMsg && <p className="text-primary text-sm">{locationMsg}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
