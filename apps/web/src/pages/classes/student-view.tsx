import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useApiQuery } from '@/hooks/use-api';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import { ClassCalendar } from '@/components/schedule/class-calendar';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { TabsNav } from '@/components/tabs-nav';
import type { ClassItem, CalendarEvent } from '@/lib/schedule';

function isActiveNow(cls: ClassItem): boolean {
  const now = new Date();
  if (cls.dayOfWeek !== now.getDay()) return false;
  const [sh, sm] = cls.startTime.split(':').map(Number);
  const [eh, em] = cls.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= sh * 60 + sm - 15 && nowMin <= eh * 60 + em + 60;
}

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

  const { data: myCheckins = [] } = useApiQuery<any[]>(
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
      () => toast.error(t('classes.checkinTooFar')),
    );
  }

  const calendar = useClassCalendar({
    classes,
    onMove: () => {},
    onSelect: () => {},
    initialView: 'day',
    readOnly: true,
  });

  function renderEvent(event: CalendarEvent) {
    const cls = event.resource;
    const active = isActiveNow(cls);
    const checkedIn = isCheckedIn(cls.id);
    return (
      <div className="flex flex-col gap-1 p-1 text-xs">
        <span className="font-heading uppercase">{cls.name}</span>
        <span>
          {cls.startTime} – {cls.endTime}
        </span>
        {active && !checkedIn && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleCheckin(cls.id);
            }}
          >
            {t('classes.checkinProximity')}
          </Button>
        )}
        {checkedIn && (
          <span className="text-primary font-bold">{t('classes.checkedIn')}</span>
        )}
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TabsNav
        items={[
          { to: '/classes', label: t('classes.title') },
          { to: '/classes/history', label: t('classes.checkinHistory') },
        ]}
      />
      {calendar.events.length > 0 ? (
        <ClassCalendar
          events={calendar.events}
          view={calendar.view}
          date={calendar.date}
          onViewChange={calendar.setView}
          onDateChange={calendar.setDate}
          onEventDrop={calendar.onEventDrop}
          onEventClick={calendar.onEventClick}
          readOnly
          toolbar={false}
          renderEvent={renderEvent}
        />
      ) : (
        <p className="text-muted-foreground text-center py-8">
          {t('common.noResults')}
        </p>
      )}
    </div>
  );
}
