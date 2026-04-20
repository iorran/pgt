import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Trash2 } from 'lucide-react';
import { TabsNav } from '@/components/tabs-nav';

interface ClassItem {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  instructor?: string;
}

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

const TYPE_BORDER_COLOR: Record<string, string> = {
  gi: 'border-l-blue-500',
  'no-gi': 'border-l-primary',
  'open-mat': 'border-l-cyan-400',
  kids: 'border-l-purple-500',
};

function getTypeBorder(type: string) {
  const key = type.toLowerCase().trim();
  return TYPE_BORDER_COLOR[key] || 'border-l-primary';
}

function isActiveNow(cls: ClassItem): boolean {
  const now = new Date();
  if (cls.dayOfWeek !== now.getDay()) {
    return false;
  }
  const [startH, startM] = cls.startTime.split(':').map(Number);
  const [endH, endM] = cls.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startH * 60 + startM - 15 && nowMin <= endH * 60 + endM + 60;
}

export default function ClassesPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: myCheckins = [] } = useApiQuery<any[]>(
    ['my-checkins', user?.id],
    `/checkins/student/${user?.id}`,
    !!user?.id && user?.role === 'student',
  );

  function isCheckedIn(classId: string): boolean {
    const today = new Date().toDateString();
    return myCheckins.some(
      (c: any) => c.classId === classId && new Date(c.checkedInAt).toDateString() === today,
    );
  }

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
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDialogOpen(false);
      createForm.reset();
    },
  });

  const editForm = useForm({
    defaultValues: {
      name: '',
      type: '',
      dayOfWeek: 0,
      startTime: '',
      endTime: '',
    },
    onSubmit: async ({ value }) => {
      await api(`/classes/${editingClass!.id}`, {
        method: 'PUT',
        body: JSON.stringify(value),
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditingClass(null);
    },
  });

  function handleEdit(cls: ClassItem) {
    editForm.reset();
    editForm.setFieldValue('name', cls.name);
    editForm.setFieldValue('type', cls.type);
    editForm.setFieldValue('dayOfWeek', cls.dayOfWeek);
    editForm.setFieldValue('startTime', cls.startTime);
    editForm.setFieldValue('endTime', cls.endTime);
    setEditingClass(cls);
  }

  const deleteMutation = useMutation({
    mutationFn: (classId: string) =>
      api(`/classes/${classId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDeletingClass(null);
    },
  });

  const checkinMutation = useMutation({
    mutationFn: (data: { classId: string; source: 'button'; latitude: number; longitude: number }) =>
      api('/checkins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    meta: { successMessage: t('classes.checkinSuccess') },
  });

  function handleProximityCheckin(classId: string) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        checkinMutation.mutate({
          classId,
          source: 'button',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        toast.error(t('classes.checkinTooFar'));
      },
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TabsNav items={[
        { to: '/classes', label: t('classes.title') },
        { to: '/classes/history', label: t('classes.checkinHistory') },
      ]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="arena-stat text-primary text-xl md:text-2xl">{classes.length}</span>
        </div>

        {user?.role === 'instructor' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <createForm.Subscribe selector={(state) => ({ daysOfWeek: state.values.daysOfWeek, isSubmitting: state.isSubmitting })}>
                  {({ daysOfWeek, isSubmitting }) => (
                    <Button type="submit" disabled={daysOfWeek.length === 0} loading={isSubmitting}>
                      {t('common.save')}
                    </Button>
                  )}
                </createForm.Subscribe>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((c) => (
          <Card key={c.id} className={`border-l-4 ${getTypeBorder(c.type)}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg">{c.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="outline">{c.type}</Badge>
                  {user?.role === 'instructor' && (
                    <>
                      <button
                        onClick={() => handleEdit(c)}
                        aria-label={t('classes.editClass')}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingClass(c)}
                        aria-label={t('classes.deleteClass')}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">
                  {c.startTime} - {c.endTime}
                </span>
                <span className="text-sm text-muted-foreground">{t(DAY_KEYS[c.dayOfWeek])}</span>
              </div>
              {c.instructor && (
                <p className="text-sm text-muted-foreground">{c.instructor}</p>
              )}
              {user?.role === 'student' && isActiveNow(c) && !isCheckedIn(c.id) && (
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    className="flex-1 min-h-[44px]"
                    onClick={() => handleProximityCheckin(c.id)}
                    loading={checkinMutation.isPending}
                  >
                    {t('classes.checkinProximity')}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => handleProximityCheckin(c.id)}
                  >
                    {t('classes.checkinQR')}
                  </Button>
                </div>
              )}
              {user?.role === 'student' && isCheckedIn(c.id) && (
                <p className="text-primary font-bold mt-2">{t('classes.checkedIn')}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {classes.length === 0 && (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider">
              {t('classes.editClass')}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              editForm.handleSubmit();
            }}
            className="flex flex-col gap-4"
          >
            <editForm.Field name="name">
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
            </editForm.Field>
            <editForm.Field name="type">
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
            </editForm.Field>
            <editForm.Field name="dayOfWeek">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('classes.daysOfWeek')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_KEYS.map((k, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => field.handleChange(i)}
                        className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                          field.state.value === i
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
            </editForm.Field>
            <div className="grid grid-cols-2 gap-4">
              <editForm.Field name="startTime">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.startTime')}</Label>
                    <Input
                      type="time"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  </div>
                )}
              </editForm.Field>
              <editForm.Field name="endTime">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.endTime')}</Label>
                    <Input
                      type="time"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  </div>
                )}
              </editForm.Field>
            </div>
            <editForm.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" loading={isSubmitting}>{t('common.save')}</Button>
              )}
            </editForm.Subscribe>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingClass} onOpenChange={(open) => !open && setDeletingClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('classes.deleteClass')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{t('classes.confirmDelete')}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeletingClass(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => deleteMutation.mutate(deletingClass!.id)}
              loading={deleteMutation.isPending}
            >
              {t('classes.deleteClass')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
