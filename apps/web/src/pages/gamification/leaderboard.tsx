import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy } from 'lucide-react';
import { beltClasses, beltKey } from '@/lib/belts';
import { formatDate } from '@/lib/format';
import { isOwner, isStudent } from '@/lib/roles';
import { GamificationTabs } from './gamification-tabs';
import { SubmitResultDialog } from './submit-result-dialog';

interface Season {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

interface LeaderboardEntry {
  studentId: string;
  rank: number;
  studentName: string;
  belt: string;
  totalPoints: number;
}

const BELTS = ['white', 'blue', 'purple', 'brown', 'black'];

function getRankStyle(rank: number) {
  if (rank === 1) return 'text-arena-gold';
  if (rank === 2) return 'text-arena-silver';
  if (rank === 3) return 'text-arena-bronze';
  return 'text-muted-foreground';
}

export default function LeaderboardPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [seasonId, setSeasonId] = useState('');
  const [category, setCategory] = useState<'adults' | 'kids'>('adults');
  const [belt, setBelt] = useState('');

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  // Auto-select first season when seasons load
  const effectiveSeasonId = seasonId || (seasons.length > 0 ? seasons[0].id : '');

  const leaderboardUrl = effectiveSeasonId
    ? `/seasons/${effectiveSeasonId}/leaderboard?category=${category}${category === 'adults' && belt ? `&belt=${belt}` : ''}`
    : '';

  const { data: entries = [] } = useApiQuery<LeaderboardEntry[]>(
    ['leaderboard', effectiveSeasonId, category, belt],
    leaderboardUrl,
    !!effectiveSeasonId,
  );

  const activeSeason = seasons.find(s => s.id === effectiveSeasonId);
  // Owners open a student's page to see and fix the entries behind their points.
  const rowHref = isOwner(user) ? (e: LeaderboardEntry) => `/gamification/students/${e.studentId}?seasonId=${effectiveSeasonId}` : undefined;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <GamificationTabs title={t('gamification.leaderboardPageTitle')} />
      {isStudent(user) && (
        <div className="flex justify-center">
          <SubmitResultDialog className="w-full sm:w-auto" />
        </div>
      )}
      {activeSeason && (
        <div className="text-center space-y-2">
          <p className="font-heading text-lg text-muted-foreground">{activeSeason.name}</p>
          {activeSeason.startDate && activeSeason.endDate && (
            <p className="font-mono text-sm text-muted-foreground">
              {formatDate(activeSeason.startDate, i18n.language)} - {formatDate(activeSeason.endDate, i18n.language)}
            </p>
          )}
        </div>
      )}

      {seasons.length === 0 ? (
        <p className="text-center text-muted-foreground">{t('gamification.noSeasons')}</p>
      ) : (
        <>
          {/* Season selector */}
          <div className="flex justify-center">
            <select
              value={effectiveSeasonId}
              onChange={e => setSeasonId(e.target.value)}
              aria-label={t('gamification.season')}
              className="min-h-11 rounded-sm border border-border bg-card px-3 py-2 text-sm font-heading"
            >
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Category Tabs */}
          <Tabs value={category} onValueChange={(v) => { setCategory(v as 'adults' | 'kids'); setBelt(''); }}>
            <div className="flex flex-col items-center gap-4">
              <TabsList>
                <TabsTrigger value="adults">{t('gamification.adults')}</TabsTrigger>
                <TabsTrigger value="kids">{t('gamification.kids')}</TabsTrigger>
              </TabsList>

              {/* Belt sub-filters for adults */}
              {category === 'adults' && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setBelt('')}
                    aria-pressed={belt === ''}
                    className={`min-h-11 px-4 rounded-sm text-xs font-heading uppercase transition-colors ${
                      belt === '' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('gamification.allBelts')}
                  </button>
                  {BELTS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBelt(b)}
                      aria-pressed={belt === b}
                      className={`min-h-11 px-4 rounded-sm text-xs font-heading uppercase transition-colors ${
                        belt === b ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t(beltKey(b))}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="adults" className="mt-6">
              <LeaderboardList entries={entries} t={t} rowHref={rowHref} />
            </TabsContent>
            <TabsContent value="kids" className="mt-6">
              <LeaderboardList entries={entries} t={t} rowHref={rowHref} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function LeaderboardList({
  entries,
  t,
  rowHref,
}: {
  entries: LeaderboardEntry[];
  t: (key: string) => string;
  rowHref?: (entry: LeaderboardEntry) => string;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <Trophy className="size-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground font-heading">{t('gamification.noResultsYet')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {entries.map((entry) => {
        const isChampion = entry.rank === 1;
        const isPodium = entry.rank <= 3;
        const rankColor = getRankStyle(entry.rank);
        const className = `flex w-full min-h-11 items-center gap-4 px-4 rounded-sm border text-left transition-all ${rowHref ? 'cursor-pointer hover:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50' : ''} ${
              isChampion
                ? 'py-5 border-primary/50 bg-primary/5 animate-glow'
                : isPodium
                  ? 'py-4 border-border bg-card'
                  : 'py-3 border-border/50 bg-card/50'
            }`;
        const content = (
          <>
            {/* Rank */}
            <div className={`font-display ${isChampion ? 'text-3xl' : isPodium ? 'text-2xl' : 'text-lg'} ${rankColor} w-12 text-center shrink-0`}>
              #{entry.rank}
            </div>

            {/* Name + Belt */}
            <div className="flex-1 min-w-0">
              <span className={`font-heading ${isChampion ? 'text-xl' : 'text-base'} truncate block`}>
                {entry.studentName}
              </span>
            </div>

            {/* Belt Badge */}
            <Badge className={`rounded-sm text-xs uppercase ${beltClasses(entry.belt)}`}>
              {t(beltKey(entry.belt))}
            </Badge>

            {/* Points */}
            <div className={`arena-stat font-mono ${isChampion ? 'text-2xl' : 'text-lg'} text-primary shrink-0`}>
              {entry.totalPoints}
              <span className="text-xs text-muted-foreground ml-1">{t('gamification.pointsShort')}</span>
            </div>
          </>
        );

        return rowHref ? (
          <Link key={entry.studentId} to={rowHref(entry)} className={className}>
            {content}
          </Link>
        ) : (
          <div key={entry.studentId} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
