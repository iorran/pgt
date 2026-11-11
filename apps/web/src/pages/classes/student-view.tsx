import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useApiQuery } from '@/hooks/use-api';
import { SeminarSignup } from '@/components/schedule/seminar-signup';
import { ClassTimeline, type TimelineActionContext } from '@/components/schedule/class-timeline';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { ClassesTabs } from '@/components/schedule/classes-tabs';
import { FirstCheckinNotice } from '@/components/first-checkin-notice';
import { addMinutes, BEFORE_START_MIN, type ClassItem } from '@/lib/schedule';

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
      (c: any) => c.class?.id === classId && new Date(c.checkedInAt).toDateString() === today,
    );
  }

  const checkinMutation = useMutation({
    mutationFn: (data: { classId: string; source: 'button'; latitude: number; longitude: number }) =>
      api('/checkins', { method: 'POST', body: JSON.stringify(data) }),
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

  function checkin(cls: ClassItem, { state, group }: TimelineActionContext) {
    if (isCheckedIn(cls.id)) {
      return (
        <span className="flex items-center gap-1.5 font-heading uppercase text-primary">
          <Check className="size-4" aria-hidden />
          {t('classes.checkedIn')}
        </span>
      );
    }
    if (state === 'upcoming') {
      return (
        <span className="block text-xs text-muted-foreground">
          {t('classes.timeline.opensAt', { time: addMinutes(cls.startTime, -BEFORE_START_MIN) })}
        </span>
      );
    }
    if (state === null || state === 'past') {
      return null;
    }
    // The API refuses a second check-in at the same start time, so say why instead of offering it.
    const sibling = group.find((o) => o.id !== cls.id && isCheckedIn(o.id));
    if (sibling) {
      return <span className="block text-xs text-muted-foreground">{t('classes.timeline.sameSlot', { name: sibling.name })}</span>;
    }
    if (state === 'open-after') {
      return (
        <Button variant="outline" className="h-11 w-full border-primary text-primary" onClick={() => handleCheckin(cls.id)}>
          {t('classes.checkinProximity')}
        </Button>
      );
    }
    return (
      <Button
        className={`h-12 w-full font-heading text-base uppercase ${cls.isSeminar ? 'bg-seminar text-seminar-foreground hover:bg-seminar/90' : ''}`}
        onClick={() => handleCheckin(cls.id)}
      >
        {t('classes.checkinProximity')}
      </Button>
    );
  }

  function renderAction(cls: ClassItem, ctx: TimelineActionContext) {
    return (
      <>
        {cls.isSeminar && <SeminarSignup cls={cls} />}
        {checkin(cls, ctx)}
      </>
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <ClassesTabs />
      {checkinsLoaded && myCheckins.length === 0 && <FirstCheckinNotice />}
      {classes.length > 0 ? (
        <ClassTimeline classes={classes} renderAction={renderAction} />
      ) : (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      )}
    </div>
  );
}
