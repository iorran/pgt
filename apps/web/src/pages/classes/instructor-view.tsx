import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import { ClassCalendar } from '@/components/schedule/class-calendar';
import { ClassCreateDialog } from '@/components/schedule/class-create-dialog';
import { ClassEditDialog } from '@/components/schedule/class-edit-dialog';
import { PageLoader } from '@/components/page-loader';
import { TabsNav } from '@/components/tabs-nav';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { CalendarPlus } from 'lucide-react';
import type { ClassItem } from '@/lib/schedule';

export function InstructorClassesView() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const moveMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }) =>
      api(`/classes/${vars.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          dayOfWeek: vars.dayOfWeek,
          startTime: vars.startTime,
          endTime: vars.endTime,
        }),
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: ['classes', user.academyId],
      });
      const prev = queryClient.getQueryData<ClassItem[]>([
        'classes',
        user.academyId,
      ]);
      queryClient.setQueryData<ClassItem[]>(
        ['classes', user.academyId],
        (old = []) => old.map((c) => (c.id === vars.id ? { ...c, ...vars } : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['classes', user.academyId], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['classes', user.academyId],
      });
    },
    meta: { successMessage: t('classes.moveSuccess') },
  });

  const editMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      patch: {
        name: string;
        type: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      };
    }) =>
      api(`/classes/${vars.id}`, {
        method: 'PUT',
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      setEditing(null);
    },
    meta: { successMessage: t('classes.classUpdated') },
  });

  const deleteMutation = useMutation({
    mutationFn: (classId: string) =>
      api(`/classes/${classId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      setEditing(null);
    },
    meta: { successMessage: t('classes.classDeleted') },
  });

  const calendar = useClassCalendar({
    classes,
    onMove: (id, patch) => moveMutation.mutate({ id, ...patch }),
    onSelect: (cls) => setEditing(cls),
  });

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
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          {t('classes.classCount', { count: classes.length })}
        </span>
        <ClassCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={async (values) => {
            // ponytail: sequential POSTs; a mid-way failure leaves earlier days created (shown after refetch).
            try {
              for (const day of values.daysOfWeek) {
                await api('/classes', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: values.name,
                    type: values.type,
                    recurrence: values.recurrence,
                    dayOfWeek: day,
                    startTime: values.startTime,
                    endTime: values.endTime,
                    academyId: user.academyId,
                  }),
                });
              }
            } catch (err) {
              toast.error((err as Error).message);
              throw err;
            } finally {
              queryClient.invalidateQueries({
                queryKey: ['classes', user.academyId],
              });
            }
            toast.success(t('classes.classesCreated'));
            setCreateOpen(false);
          }}
        />
      </div>

      {classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
          <CalendarPlus className="size-12" />
          <p className="text-lg font-heading">{t('classes.noClasses')}</p>
          <Button onClick={() => setCreateOpen(true)}>{t('classes.createClass')}</Button>
        </div>
      )}

      <ClassCalendar
        events={calendar.events}
        view={calendar.view}
        date={calendar.date}
        onViewChange={calendar.setView}
        onDateChange={calendar.setDate}
        onEventDrop={calendar.onEventDrop}
        onEventClick={calendar.onEventClick}
      />

      <ClassEditDialog
        cls={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={async (patch) => {
          if (!editing) return;
          await editMutation.mutateAsync({ id: editing.id, patch });
        }}
        onDelete={async (classId) => {
          await deleteMutation.mutateAsync(classId);
        }}
      />
    </div>
  );
}
