import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
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
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isInstructor = user?.role === 'instructor';
  const queryClient = useQueryClient();
  const [locationMsg, setLocationMsg] = useState('');

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

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.settings')}
      </h1>

      {isInstructor && academy && (
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

            {locationMsg && (
              <p className="text-primary text-sm">{locationMsg}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
