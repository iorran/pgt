import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl uppercase tracking-tight">{t('gamification.seasonsPageTitle')}</h1>

        {user?.role === 'instructor' && (
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
                      <Label>{t('gamification.seasonName')}</Label>
                      <Input
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
                      <Label>{t('gamification.startDate')}</Label>
                      <Input
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
                      <Label>{t('gamification.endDate')}</Label>
                      <Input
                        type="date"
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
                      <Label>{t('gamification.prize')}</Label>
                      <Input
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
                          <Label className="text-xs text-arena-gold">{t('gamification.first')}</Label>
                          <Input
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
                          <Label className="text-xs text-arena-silver">{t('gamification.second')}</Label>
                          <Input
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
                          <Label className="text-xs text-arena-bronze">{t('gamification.third')}</Label>
                          <Input
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
