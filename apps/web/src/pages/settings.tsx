import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { useApiQuery } from '@/hooks/use-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';
import { ModalitiesCard } from '@/components/modalities-card';

interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  joinCode: string;
  addOnName: string;
  addOnPrice: string;
  addOnTeacherShare: string;
  recruitedSharePercent: number;
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
    <div className="space-y-6">
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
                <span role="status" aria-live="polite" className="sr-only">
                  {copied ? t('onboarding.copied') : ''}
                </span>
              </div>
            </div>
            <Button className="w-full sm:w-auto" onClick={handleShareWhatsApp}>
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
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleSetLocation}>
              {t('onboarding.useMyLocation')}
            </Button>
            {locationMsg && <p className="text-primary text-sm">{locationMsg}</p>}
          </CardContent>
        </Card>
      )}

      {isOwnerUser && <ModalitiesCard />}

      {isOwnerUser && academy && <FinanceSettingsCard key={JSON.stringify(academy)} academy={academy} />}
    </div>
  );
}

// Settings › Financeiro: the Class Add-on and what Payout Teachers get.
function FinanceSettingsCard({ academy }: { academy: AcademyInfo }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    addOnName: academy.addOnName,
    addOnPrice: String(Number(academy.addOnPrice)),
    addOnTeacherShare: String(Number(academy.addOnTeacherShare)),
    recruitedSharePercent: String(academy.recruitedSharePercent),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api('/finance/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...form, recruitedSharePercent: Number(form.recruitedSharePercent) }),
      }),
    meta: { successMessage: t('finance.settings.saved') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-mine'] });
      for (const key of ['overdue', 'finance-payouts', 'finance-balance']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
  const field = (key: keyof typeof form, props: ComponentProps<typeof Input>) => (
    <div className="space-y-2">
      <Label htmlFor={`finance-${key}`}>{t(`finance.settings.${key}`)}</Label>
      <Input
        id={`finance-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
        {...props}
      />
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-heading text-lg uppercase">{t('finance.settings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {field('addOnName', { maxLength: 50 })}
          {field('addOnPrice', { type: 'number', min: 0, step: '0.01', inputMode: 'decimal' })}
          {field('addOnTeacherShare', { type: 'number', min: 0, step: '0.01', inputMode: 'decimal' })}
          {field('recruitedSharePercent', { type: 'number', min: 0, max: 100, step: 1 })}
          <Button type="submit" variant="outline" className="sm:col-span-2 sm:justify-self-start" loading={mutation.isPending}>
            {t('finance.settings.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
