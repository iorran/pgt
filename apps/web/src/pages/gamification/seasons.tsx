import { useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { CalendarPlus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { GamificationTabs } from './gamification-tabs';
import { invalidateRanking } from './result-control';

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prize?: string;
  active?: boolean;
  // Points per podium position, e.g. { 1: 10, 2: 7, 3: 5 }.
  pointsConfig?: Record<number, number>;
}

function isSeasonActive(s: Season): boolean {
  if (s.active !== undefined) return s.active;
  const now = new Date();
  return new Date(s.startDate) <= now && now <= new Date(s.endDate);
}

export default function SeasonsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <GamificationTabs title={t('gamification.seasonsTitle')} />
      <div className="flex items-center justify-between">
        {isOwner(user) && (
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            <DialogTrigger render={<Button />}>
              {t('gamification.createSeason')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('gamification.createSeason')}</DialogTitle>
              </DialogHeader>
              <SeasonForm onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {seasons.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <CalendarPlus className="size-12 text-muted-foreground mx-auto" aria-hidden />
          <p className="text-muted-foreground font-heading">{t('gamification.noSeasons')}</p>
          {isOwner(user) && (
            <Button onClick={() => setDialogOpen(true)}>{t('gamification.createSeason')}</Button>
          )}
        </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-heading text-xl">{s.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {active && (
                        <Badge className="bg-primary text-primary-foreground">{t('gamification.active')}</Badge>
                      )}
                      {isOwner(user) && <EditSeasonDialog season={s} />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-muted-foreground">
                      {formatDate(s.startDate, i18n.language)} - {formatDate(s.endDate, i18n.language)}
                    </span>
                  </div>
                  {s.prize && (
                    <p className="text-sm text-muted-foreground">{t('gamification.prize')}: {s.prize}</p>
                  )}
                  {s.pointsConfig && (
                    <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
                      <span className="text-arena-gold">{t('gamification.first')}: {s.pointsConfig[1]} {t('gamification.pointsShort')}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-silver">{t('gamification.second')}: {s.pointsConfig[2]} {t('gamification.pointsShort')}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-bronze">{t('gamification.third')}: {s.pointsConfig[3]} {t('gamification.pointsShort')}</span>
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

// Create (no `season`) or edit a season. Mounted only while its dialog is open, so it starts fresh each time.
function SeasonForm({ season, onDone }: { season?: Season; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: any) =>
      season
        ? api<Season>(`/seasons/${season.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api<Season>('/seasons', { method: 'POST', body: JSON.stringify({ ...body, academyId: user.academyId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });

  const form = useForm({
    defaultValues: {
      name: season?.name ?? '',
      startDate: season?.startDate.slice(0, 10) ?? '',
      endDate: season?.endDate.slice(0, 10) ?? '',
      prize: season?.prize ?? '',
      firstPoints: String(season?.pointsConfig?.[1] ?? 10),
      secondPoints: String(season?.pointsConfig?.[2] ?? 7),
      thirdPoints: String(season?.pointsConfig?.[3] ?? 5),
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        name: value.name,
        startDate: value.startDate,
        endDate: value.endDate,
        prize: value.prize,
        pointsConfig: {
          1: Number(value.firstPoints),
          2: Number(value.secondPoints),
          3: Number(value.thirdPoints),
        },
      });
      onDone();
    },
  });

  const startDate = useStore(form.store, (state) => state.values.startDate);

  return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="season-name">{t('gamification.seasonName')}</Label>
              <Input
                id="season-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
              />
            </div>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="season-start">{t('gamification.startDate')}</Label>
              <Input
                id="season-start"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
              />
            </div>
          )}
        </form.Field>
        <form.Field name="endDate">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="season-end">{t('gamification.endDate')}</Label>
              <Input
                id="season-end"
                type="date"
                min={startDate || undefined}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
              />
            </div>
          )}
        </form.Field>
        <form.Field name="prize">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="season-prize">{t('gamification.prize')}</Label>
              <Input
                id="season-prize"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </div>
          )}
        </form.Field>
        <div className="space-y-2">
          <Label>{t('gamification.pointsConfig')}</Label>
          <div className="grid grid-cols-3 gap-2">
            <form.Field name="firstPoints">
              {(field) => (
                <div>
                  <Label htmlFor="season-first" className="text-xs text-arena-gold">{t('gamification.first')}</Label>
                  <Input
                    id="season-first"
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="secondPoints">
              {(field) => (
                <div>
                  <Label htmlFor="season-second" className="text-xs text-arena-silver">{t('gamification.second')}</Label>
                  <Input
                    id="season-second"
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="thirdPoints">
              {(field) => (
                <div>
                  <Label htmlFor="season-third" className="text-xs text-arena-bronze">{t('gamification.third')}</Label>
                  <Input
                    id="season-third"
                    type="number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={mutation.isPending}>{t(season ? 'common.save' : 'common.create')}</Button>
      </form>
  );
}

// Edit, then offer to re-apply the new points to approved results.
function EditSeasonDialog({ season }: { season: Season }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const recalculate = useMutation({
    mutationFn: () => api<{ updated: number }>(`/seasons/${season.id}/recalculate`, { method: 'POST' }),
    onSuccess: ({ updated }) => {
      invalidateRanking(queryClient);
      toast.success(t('gamification.control.recalculated', { count: updated }));
      setOpen(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setSaved(false);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>{t('common.edit')}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase">{saved ? t('gamification.control.recalculate') : season.name}</DialogTitle>
        </DialogHeader>
        {saved ? (
          <>
            <p className="text-sm text-muted-foreground">{t('gamification.control.recalculateHelp')}</p>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t('gamification.control.notNow')}</DialogClose>
              <Button loading={recalculate.isPending} onClick={() => recalculate.mutate()}>
                {t('gamification.control.recalculate')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <SeasonForm season={season} onDone={() => setSaved(true)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
