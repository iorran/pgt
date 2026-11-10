import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useApiQuery } from '@/hooks/use-api';
import { ClassDayList } from '@/components/schedule/class-day-list';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { TabsNav } from '@/components/tabs-nav';
import { FirstCheckinNotice } from '@/components/first-checkin-notice';
import type { ClassItem } from '@/lib/schedule';

export function StudentClassesView() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: myCheckins = [], isSuccess: checkinsLoaded } = useApiQuery<any[]>(
    ['my-checkins', user?.id],
    `/checkins/student/${user?.id}`,
    !!user?.id,
  );

  function isCheckedIn(classId: string): boolean {
    const today = new Date().toDateString();
    return myCheckins.some(
      (c: any) =>
        c.class?.id === classId && new Date(c.checkedInAt).toDateString() === today,
    );
  }

  const checkinMutation = useMutation({
    mutationFn: (data: {
      classId: string;
      source: 'button';
      latitude: number;
      longitude: number;
    }) =>
      api('/checkins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-checkins'] });
    },
    meta: { successMessage: t('classes.checkinSuccess') },
  });

  function handleCheckin(classId: string) {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        checkinMutation.mutate({
          classId,
          source: 'button',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(t('classes.locationDenied'), { description: t('classes.locationDeniedHelp') });
        } else {
          toast.error(t('classes.locationUnavailable'));
        }
      },
    );
  }

  function renderAction(cls: ClassItem, live: boolean) {
    if (isCheckedIn(cls.id)) {
      return <span className="font-heading uppercase text-primary">{t('classes.checkedIn')}</span>;
    }
    if (!live) {
      return null;
    }
    return (
      <Button className="h-11 w-full" onClick={() => handleCheckin(cls.id)}>
        {t('classes.checkinProximity')}
      </Button>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav
        title={t('nav.classes')}
        items={[
          { to: '/classes', label: t('classes.title') },
          { to: '/classes/history', label: t('classes.checkinHistory') },
        ]}
      />
      {checkinsLoaded && myCheckins.length === 0 && <FirstCheckinNotice />}
      {classes.length > 0 ? (
        <ClassDayList classes={classes} renderAction={renderAction} />
      ) : (
        <p className="text-muted-foreground text-center py-8">
          {t('common.noResults')}
        </p>
      )}
    </div>
  );
}
