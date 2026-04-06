import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
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

export default function ClassesPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', recurrence: 'weekly', dayOfWeek: '1', startTime: '', endTime: '' });
  const [checkinMsg, setCheckinMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<ClassItem[]>(`/classes?academyId=${user.academyId}`)
      .then(setClasses)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<ClassItem>('/classes', {
      method: 'POST',
      body: JSON.stringify({ ...form, dayOfWeek: Number(form.dayOfWeek), academyId: user.academyId }),
    });
    setClasses(prev => [...prev, created]);
    setForm({ name: '', type: '', recurrence: 'weekly', dayOfWeek: '1', startTime: '', endTime: '' });
    setDialogOpen(false);
  }

  async function handleCheckin(classId: string) {
    try {
      await api('/checkins', {
        method: 'POST',
        body: JSON.stringify({ classId, studentId: user.id }),
      });
      setCheckinMsg(t('classes.checkinSuccess'));
      setTimeout(() => setCheckinMsg(''), 3000);
    } catch {
      setCheckinMsg(t('classes.checkinError'));
    }
  }

  if (loading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

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
                  <Label>{t('classes.dayOfWeek')}</Label>
                  <select
                    value={form.dayOfWeek}
                    onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                    className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                  >
                    {DAY_KEYS.map((k, i) => (
                      <option key={i} value={i}>{t(k)}</option>
                    ))}
                  </select>
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
                <Button type="submit">{t('common.save')}</Button>
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
              {user?.role === 'student' && (
                <Button variant="outline" className="w-full mt-2" onClick={() => handleCheckin(c.id)}>
                  {t('classes.checkin')}
                </Button>
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
