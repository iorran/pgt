import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prize?: string;
  active?: boolean;
  pointsConfig?: { first: number; second: number; third: number };
}

function isSeasonActive(s: Season): boolean {
  if (s.active !== undefined) return s.active;
  const now = new Date();
  return new Date(s.startDate) <= now && now <= new Date(s.endDate);
}

export default function SeasonsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', prize: '', firstPoints: '10', secondPoints: '7', thirdPoints: '5' });

  useEffect(() => {
    if (!user?.academyId) return;
    api<Season[]>(`/seasons?academyId=${user.academyId}`)
      .then(setSeasons)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      prize: form.prize,
      pointsConfig: { first: Number(form.firstPoints), second: Number(form.secondPoints), third: Number(form.thirdPoints) },
      academyId: user.academyId,
    };
    const created = await api<Season>('/seasons', { method: 'POST', body: JSON.stringify(body) });
    setSeasons(prev => [...prev, created]);
    setForm({ name: '', startDate: '', endDate: '', prize: '', firstPoints: '10', secondPoints: '7', thirdPoints: '5' });
    setDialogOpen(false);
  }

  if (loading) return <div className="p-6 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl uppercase tracking-tight">{t('gamification.seasonsPageTitle')}</h1>

        {user?.role === 'instructor' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              {t('gamification.createSeason')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('gamification.createSeason')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('gamification.seasonName')}</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('gamification.startDate')}</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('gamification.endDate')}</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('gamification.prize')}</Label>
                  <Input value={form.prize} onChange={e => setForm(f => ({ ...f, prize: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('gamification.pointsConfig')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-arena-gold">{t('gamification.first')}</Label>
                      <Input type="number" value={form.firstPoints} onChange={e => setForm(f => ({ ...f, firstPoints: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-arena-silver">{t('gamification.second')}</Label>
                      <Input type="number" value={form.secondPoints} onChange={e => setForm(f => ({ ...f, secondPoints: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-arena-bronze">{t('gamification.third')}</Label>
                      <Input type="number" value={form.thirdPoints} onChange={e => setForm(f => ({ ...f, thirdPoints: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full">{t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="text-muted-foreground">{t('common.noResults')}</p>
      ) : (
        <div className="space-y-4">
          {seasons.map(s => {
            const active = isSeasonActive(s);
            return (
              <Card
                key={s.id}
                className={`rounded-sm ${active ? 'border-primary animate-glow' : 'border-border'}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading text-xl">{s.name}</CardTitle>
                    {active && (
                      <Badge className="bg-primary text-primary-foreground">{t('gamification.active')}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-muted-foreground">
                      {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  {s.prize && (
                    <p className="text-sm text-muted-foreground">{t('gamification.prize')}: {s.prize}</p>
                  )}
                  {s.pointsConfig && (
                    <div className="flex items-center gap-3 text-sm font-mono">
                      <span className="text-arena-gold">{t('gamification.first')}: {s.pointsConfig.first}pts</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-silver">{t('gamification.second')}: {s.pointsConfig.second}pts</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-bronze">{t('gamification.third')}: {s.pointsConfig.third}pts</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
