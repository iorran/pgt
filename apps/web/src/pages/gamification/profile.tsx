import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Flame } from 'lucide-react';
import { isStudent } from '@/lib/roles';
import { formatDate } from '@/lib/format';
import { GamificationTabs } from './gamification-tabs';
import { PODIUM, SubmitResultDialog } from './submit-result-dialog';

// GET /api/gamification/profile/:id (xp is a SQL SUM, so it may arrive as a string)
interface GamificationProfile {
  xp: number | string;
  streak: { currentStreak: number; longestStreak: number };
  badges: { id: string; name: string; description?: string; earnedAt: string }[];
}

interface MyResult {
  id: string;
  competitionName: string;
  competitionDate: string;
  position: number;
  status: 'pending' | 'approved' | 'rejected';
  pointsAwarded: number;
}

// Status is spelled out in the badge text; colour only reinforces it.
const STATUS_STYLES: Record<MyResult['status'], string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30 dark:text-yellow-400',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30 dark:text-green-400',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function GamificationProfilePage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;

  const { data: profile, isLoading } = useApiQuery<GamificationProfile>(
    ['gamification-profile', user?.id],
    `/gamification/profile/${user?.id}`,
    !!user?.id,
  );

  const student = isStudent(user);
  const { data: myResults } = useApiQuery<MyResult[]>(['my-results', user?.id], '/competition-results/mine', student);

  if (isLoading) return <PageLoader />;
  if (!profile) return <div className="text-muted-foreground">{t('common.noResults')}</div>;

  // Fresh students may have no gamification rows yet; the API can return
  // a partial object. Default each numeric field so the page never crashes.
  const totalXp = Number(profile.xp ?? 0);
  const currentStreak = profile.streak?.currentStreak ?? 0;
  const longestStreak = profile.streak?.longestStreak ?? 0;
  const badges = profile.badges ?? [];

  return (
    <div className="space-y-8">
      <GamificationTabs title={t('gamification.profileTitle')} />
      {/* XP Header */}
      <div className="text-center space-y-1">
        <div className="font-display text-5xl md:text-6xl text-primary arena-glow">
          {totalXp.toLocaleString()}
        </div>
        <p className="font-heading text-lg text-muted-foreground uppercase">{t('gamification.totalXp')}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-sm text-center">
          <CardContent className="p-6 space-y-1">
            <div className="arena-stat text-3xl font-mono text-primary">
              {currentStreak}
            </div>
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              {t('gamification.currentStreak')}
              <Flame className="size-4 text-arena-gold" aria-hidden />
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-sm text-center">
          <CardContent className="p-6 space-y-1">
            <div className="arena-stat text-3xl font-mono text-primary">
              {longestStreak}
            </div>
            <p className="text-sm text-muted-foreground">{t('gamification.longestStreak')}</p>
          </CardContent>
        </Card>
      </div>

      {myResults && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl md:text-2xl uppercase">{t('gamification.results.mine')}</h2>
            {myResults.length > 0 && <SubmitResultDialog className="w-full sm:w-auto" />}
          </div>
          {myResults.length === 0 ? (
            <div className="space-y-3 text-center">
              <p className="text-muted-foreground">{t('gamification.results.empty')}</p>
              <SubmitResultDialog className="w-full sm:w-auto" />
            </div>
          ) : (
            <ul className="space-y-2">
              {myResults.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-sm border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-base truncate">{r.competitionName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{formatDate(r.competitionDate, i18n.language)}</p>
                  </div>
                  <span className="font-heading shrink-0">
                    {t(PODIUM[r.position - 1].key)}
                  </span>
                  <Badge className={`shrink-0 ${STATUS_STYLES[r.status]}`}>
                    {t(`gamification.results.status.${r.status}`)}
                    {r.status === 'approved' && ` +${r.pointsAwarded} ${t('gamification.pointsShort')}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Badges */}
      <div className="space-y-4">
        <h2 className="font-heading text-xl md:text-2xl uppercase">{t('gamification.badges')}</h2>
        {badges.length === 0 ? (
          <p className="text-muted-foreground">{t('gamification.noBadges')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map(b => (
              <Card key={b.id} className="rounded-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                    <Award className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-base">{b.name}</p>
                    {b.description && (
                      <p className="text-sm text-muted-foreground">{b.description}</p>
                    )}
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {new Date(b.earnedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
