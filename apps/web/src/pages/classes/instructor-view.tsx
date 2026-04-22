import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import { ClassCalendar } from '@/components/schedule/class-calendar';
import { ClassEditDialog } from '@/components/schedule/class-edit-dialog';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TabsNav } from '@/components/tabs-nav';
import type { ClassItem } from '@/lib/schedule';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

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
  });

  const calendar = useClassCalendar({
    classes,
    onMove: (id, patch) => moveMutation.mutate({ id, ...patch }),
    onSelect: (cls) => setEditing(cls),
  });

  const createForm = useForm({
    defaultValues: {
      name: '',
      type: '',
      recurrence: 'weekly',
      daysOfWeek: [] as number[],
      startTime: '',
      endTime: '',
    },
    onSubmit: async ({ value }) => {
      for (const day of value.daysOfWeek) {
        await api('/classes', {
          method: 'POST',
          body: JSON.stringify({
            name: value.name,
            type: value.type,
            recurrence: value.recurrence,
            dayOfWeek: day,
            startTime: value.startTime,
            endTime: value.endTime,
            academyId: user.academyId,
          }),
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['classes', user.academyId],
      });
      setCreateOpen(false);
      createForm.reset();
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TabsNav
        items={[
          { to: '/classes', label: t('classes.title') },
          { to: '/classes/history', label: t('classes.checkinHistory') },
        ]}
      />
      <div className="flex items-center justify-between">
        <span className="arena-stat text-primary text-xl md:text-2xl">
          {classes.length}
        </span>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            {t('classes.createClass')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-wider">
                {t('classes.createClass')}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createForm.handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <createForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.className')}</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                    />
                  </div>
                )}
              </createForm.Field>
              <createForm.Field name="type">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.classType')}</Label>
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                      className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                    >
                      <option value="">--</option>
                      <option value="gi">Gi</option>
                      <option value="no-gi">No-Gi</option>
                      <option value="open-mat">Open Mat</option>
                      <option value="kids">Kids</option>
                    </select>
                  </div>
                )}
              </createForm.Field>
              <createForm.Field name="daysOfWeek">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.daysOfWeek')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_KEYS.map((k, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const current = field.state.value;
                            field.handleChange(
                              current.includes(i)
                                ? current.filter((d) => d !== i)
                                : [...current, i],
                            );
                          }}
                          className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                            field.state.value.includes(i)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                          }`}
                        >
                          {t(k)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </createForm.Field>
              <div className="grid grid-cols-2 gap-4">
                <createForm.Field name="startTime">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('classes.startTime')}</Label>
                      <Input
                        type="time"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
                <createForm.Field name="endTime">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('classes.endTime')}</Label>
                      <Input
                        type="time"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
              </div>
              <createForm.Subscribe
                selector={(state) => ({
                  daysOfWeek: state.values.daysOfWeek,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ daysOfWeek, isSubmitting }) => (
                  <Button
                    type="submit"
                    disabled={daysOfWeek.length === 0}
                    loading={isSubmitting}
                  >
                    {t('common.save')}
                  </Button>
                )}
              </createForm.Subscribe>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
      />
    </div>
  );
}
