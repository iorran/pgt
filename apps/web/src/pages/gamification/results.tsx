import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { isOwner, isStudent } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, Navigate } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { GamificationTabs } from './gamification-tabs';
import { SubmitResultDialog } from './submit-result-dialog';
import { AdjustPointsDialog, ResultCard, invalidateRanking, type CompetitionResult } from './result-control';

interface Season {
  id: string;
  name: string;
}

const FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export default function ResultsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [seasonId, setSeasonId] = useState('');
  const [filter, setFilter] = useState<Filter>('pending');

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const effectiveSeasonId = seasonId || (seasons.length > 0 ? seasons[0].id : '');

  const { data: results = [] } = useApiQuery<CompetitionResult[]>(
    ['competition-results', effectiveSeasonId, filter],
    `/competition-results?seasonId=${effectiveSeasonId}${filter === 'all' ? '' : `&status=${filter}`}`,
    !!effectiveSeasonId && isOwner(user),
  );

  const approvalMutation = useMutation({
    mutationFn: ({ resultId, status }: { resultId: string; status: 'approved' | 'rejected' }) => {
      const action = status === 'approved' ? 'approve' : 'reject';
      return api(`/competition-results/${resultId}/${action}`, {
        method: 'PUT',
      });
    },
    onSuccess: () => invalidateRanking(queryClient),
  });

  // Students send results from the ranking/profile dialog; this page is the owner's.
  if (isStudent(user)) {
    return <Navigate to="/gamification" replace />;
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <GamificationTabs title={t('gamification.resultsTitle')} />

      {isOwner(user) && seasons.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitResultDialog owner className="w-full sm:w-auto" />
          <AdjustPointsDialog className="w-full sm:w-auto" />
        </div>
      )}

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
          <div className="flex flex-wrap gap-2">
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
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`min-h-11 px-4 rounded-sm text-xs font-heading uppercase transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`gamification.control.filter.${f}`)}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <p className="text-muted-foreground">{t('common.noResults')}</p>
          ) : (
            <div className="space-y-3">
              {results.map((r) => {
                const rowPending = approvalMutation.isPending && approvalMutation.variables?.resultId === r.id;
                return (
                  <ResultCard
                    key={r.id}
                    result={r}
                    showStudent
                    actions={
                      r.status === 'pending' && (
                        <>
                          <Button size="sm" disabled={rowPending} loading={rowPending && approvalMutation.variables?.status === 'approved'} onClick={() => approvalMutation.mutate({ resultId: r.id, status: 'approved' })}>
                            {t('gamification.approve')}
                          </Button>
                          <Button size="sm" variant="destructive" disabled={rowPending} loading={rowPending && approvalMutation.variables?.status === 'rejected'} onClick={() => approvalMutation.mutate({ resultId: r.id, status: 'rejected' })}>
                            {t('gamification.reject')}
                          </Button>
                        </>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
