import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
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
  const [form, setForm] = useState({ name: '', type: '', recurrence: 'weekly', daysOfWeek: [] as number[], startTime: '', endTime: '' });
  const [checkinMsg, setCheckinMsg] = useState('');

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

  const createMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const newClasses: ClassItem[] = [];
      for (const day of formData.daysOfWeek) {
        const created = await api<ClassItem>('/classes', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            type: formData.type,
            recurrence: formData.recurrence,
            dayOfWeek: day,
            startTime: formData.startTime,
            endTime: formData.endTime,
            academyId: user.academyId,
          }),
        });
        newClasses.push(created);
      }
      return newClasses;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
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
      setCheckinMsg(t('classes.checkinSuccess'));
      setTimeout(() => setCheckinMsg(''), 3000);
    },
    onError: (err: Error) => {
      setCheckinMsg(err.message);
      setTimeout(() => setCheckinMsg(''), 5000);
    },
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
        setCheckinMsg(t('classes.checkinTooFar'));
        setTimeout(() => setCheckinMsg(''), 5000);
      },
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createMutation.mutateAsync(form);
    setForm({ name: '', type: '', recurrence: 'weekly', daysOfWeek: [], startTime: '', endTime: '' });
    setDialogOpen(false);
  }

  function toggleDay(day: number) {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter(d => d !== day)
        : [...f.daysOfWeek, day],
    }));
  }

  if (isLoading) {
    return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-heading uppercase tracking-wider text-lg">{t('classes.title')}</h1>
          <span className="arena-stat text-primary text-2xl">{classes.length}</span>
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
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t('classes.className')}</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('classes.classType')}</Label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
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
                <div className="space-y-2">
                  <Label>{t('classes.daysOfWeek')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_KEYS.map((k, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                          form.daysOfWeek.includes(i)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                        }`}
                      >
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('classes.startTime')}</Label>
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('classes.endTime')}</Label>
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={form.daysOfWeek.length === 0}>{t('common.save')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {checkinMsg && (
        <p className="text-primary font-bold">{checkinMsg}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(c => (
          <Card key={c.id} className={`border-l-4 ${getTypeBorder(c.type)}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg">{c.name}</CardTitle>
                <Badge variant="outline">{c.type}</Badge>
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
                    className="flex-1"
                    onClick={() => handleProximityCheckin(c.id)}
                    disabled={checkinMutation.isPending}
                  >
                    {t('classes.checkinProximity')}
                  </Button>
                  <Button
                    variant="outline"
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
    </div>
  );
}
