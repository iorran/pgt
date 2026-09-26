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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarPlus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { GamificationTabs } from './gamification-tabs';

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
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      api<Season>('/seasons', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });

  const form = useForm({
    defaultValues: {
      name: '',
      startDate: '',
      endDate: '',
      prize: '',
      firstPoints: '10',
      secondPoints: '7',
      thirdPoints: '5',
    },
    onSubmit: async ({ value }) => {
      const body = {
        name: value.name,
        startDate: value.startDate,
        endDate: value.endDate,
        prize: value.prize,
        pointsConfig: {
          first: Number(value.firstPoints),
          second: Number(value.secondPoints),
          third: Number(value.thirdPoints),
        },
        academyId: user.academyId,
      };
      await createMutation.mutateAsync(body);
      form.reset();
      setDialogOpen(false);
    },
  });

  const startDate = useStore(form.store, (state) => state.values.startDate);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <GamificationTabs title={t('gamification.seasonsTitle')} />
      <div className="flex items-center justify-between">
        {isOwner(user) && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                form.reset();
              }
            }}
          >
            <DialogTrigger render={<Button />}>
              {t('gamification.createSeason')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('gamification.createSeason')}</DialogTitle>
              </DialogHeader>
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
                <Button type="submit" className="w-full" loading={createMutation.isPending}>{t('common.create')}</Button>
              </form>
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
                      {formatDate(s.startDate, i18n.language)} - {formatDate(s.endDate, i18n.language)}
                    </span>
                  </div>
                  {s.prize && (
                    <p className="text-sm text-muted-foreground">{t('gamification.prize')}: {s.prize}</p>
                  )}
                  {s.pointsConfig && (
                    <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
                      <span className="text-arena-gold">{t('gamification.first')}: {s.pointsConfig.first} {t('gamification.pointsShort')}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-silver">{t('gamification.second')}: {s.pointsConfig.second} {t('gamification.pointsShort')}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-arena-bronze">{t('gamification.third')}: {s.pointsConfig.third} {t('gamification.pointsShort')}</span>
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
