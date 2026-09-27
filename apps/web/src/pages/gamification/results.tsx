import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { isOwner, isStudent } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, Navigate } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { GamificationTabs } from './gamification-tabs';
import { POSITION_STYLES, SubmitResultDialog } from './submit-result-dialog';

interface CompetitionResult {
  id: string;
  competitionName: string;
  date: string;
  position: number;
  status: string;
  studentName?: string;
  pointsAwarded?: number;
}

interface Season {
  id: string;
  name: string;
}

const POSITION_KEYS: Record<number, string> = {
  1: 'gamification.first',
  2: 'gamification.second',
  3: 'gamification.third',
};

export default function ResultsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [seasonId, setSeasonId] = useState('');

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const effectiveSeasonId = seasonId || (seasons.length > 0 ? seasons[0].id : '');

  const { data: results = [] } = useApiQuery<CompetitionResult[]>(
    ['competition-results', effectiveSeasonId, 'pending'],
    `/competition-results?seasonId=${effectiveSeasonId}&status=pending`,
    !!effectiveSeasonId && isOwner(user),
  );

  const approvalMutation = useMutation({
    mutationFn: ({ resultId, status }: { resultId: string; status: 'approved' | 'rejected' }) => {
      const action = status === 'approved' ? 'approve' : 'reject';
      return api(`/competition-results/${resultId}/${action}`, {
        method: 'PUT',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-results'] });
    },
  });

  // Students send results from the ranking/profile dialog; this page is the owner's.
  if (isStudent(user)) {
    return <Navigate to="/gamification" replace />;
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <GamificationTabs title={t('gamification.resultsTitle')} />

      {isOwner(user) && seasons.length > 0 && <SubmitResultDialog owner className="w-full sm:w-auto" />}

      {isOwner(user) && seasons.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <CalendarPlus className="size-12 text-muted-foreground mx-auto" aria-hidden />
          <p className="text-muted-foreground font-heading">{t('gamification.noSeasons')}</p>
          <Link to="/gamification/seasons" className={buttonVariants()}>
            {t('gamification.createSeason')}
          </Link>
        </div>
      )}

      {isOwner(user) && seasons.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg uppercase">{t('gamification.pendingResults')}</h2>
          <div>
            <select
              value={effectiveSeasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              aria-label={t('gamification.season')}
              className="min-h-11 rounded-sm border border-border bg-card px-3 py-2 text-sm font-heading"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {results.length === 0 ? (
            <p className="text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <div className="space-y-3">
              {results.map((r) => {
                const rowPending = approvalMutation.isPending && approvalMutation.variables?.resultId === r.id;
                return (
                  <Card key={r.id} className="rounded-sm">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-heading text-base">{r.studentName || '-'}</p>
                          <p className="text-sm text-muted-foreground">{r.competitionName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{formatDate(r.date, i18n.language)}</p>
                        </div>
                        <Badge className={POSITION_STYLES[r.position] || ''}>
                          {POSITION_KEYS[r.position] ? t(POSITION_KEYS[r.position]) : t('gamification.positionN', { position: r.position })}
                        </Badge>
                        {r.status === 'approved' && r.pointsAwarded && (
                          <span className="arena-stat text-primary font-mono">+{r.pointsAwarded} {t('gamification.pointsShort')}</span>
                        )}
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" disabled={rowPending} loading={rowPending && approvalMutation.variables?.status === 'approved'} onClick={() => approvalMutation.mutate({ resultId: r.id, status: 'approved' })}>
                            {t('gamification.approve')}
                          </Button>
                          <Button size="sm" variant="destructive" disabled={rowPending} loading={rowPending && approvalMutation.variables?.status === 'rejected'} onClick={() => approvalMutation.mutate({ resultId: r.id, status: 'rejected' })}>
                            {t('gamification.reject')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
