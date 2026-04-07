import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy } from 'lucide-react';

interface Season {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  belt: string;
  totalPoints: number;
}

const BELTS = ['white', 'blue', 'purple', 'brown', 'black'];

const BELT_COLORS: Record<string, string> = {
  white: 'bg-white text-black border-white/30',
  blue: 'bg-blue-600 text-white border-blue-500/30',
  purple: 'bg-purple-600 text-white border-purple-500/30',
  brown: 'bg-amber-800 text-white border-amber-700/30',
  black: 'bg-black text-white border-white/20',
};

function getRankStyle(rank: number) {
  if (rank === 1) return 'text-arena-gold';
  if (rank === 2) return 'text-arena-silver';
  if (rank === 3) return 'text-arena-bronze';
  return 'text-muted-foreground';
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
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

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-8">
      {/* Hero Title */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-5xl text-primary arena-glow tracking-wider">
          {t('gamification.leaderboardPageTitle')}
        </h1>
        {activeSeason && (
          <div className="space-y-1">
            <p className="font-heading text-lg text-muted-foreground">{activeSeason.name}</p>
            {activeSeason.startDate && activeSeason.endDate && (
              <p className="font-mono text-sm text-muted-foreground">
                {new Date(activeSeason.startDate).toLocaleDateString()} - {new Date(activeSeason.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="text-center text-muted-foreground">{t('gamification.noSeasons')}</p>
      ) : (
        <>
          {/* Season selector */}
          <div className="flex justify-center">
            <select
              value={effectiveSeasonId}
              onChange={e => setSeasonId(e.target.value)}
              className="rounded-sm border border-border bg-card px-3 py-2 text-sm font-heading"
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
                    onClick={() => setBelt('')}
                    className={`px-3 py-1 rounded-sm text-xs font-heading uppercase transition-colors ${
                      belt === '' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('gamification.allBelts')}
                  </button>
                  {BELTS.map(b => (
                    <button
                      key={b}
                      onClick={() => setBelt(b)}
                      className={`px-3 py-1 rounded-sm text-xs font-heading uppercase transition-colors ${
                        belt === b ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <TabsContent value="adults" className="mt-6">
              <LeaderboardList entries={entries} t={t} />
            </TabsContent>
            <TabsContent value="kids" className="mt-6">
              <LeaderboardList entries={entries} t={t} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function LeaderboardList({ entries, t }: { entries: LeaderboardEntry[]; t: (key: string) => string }) {
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

        return (
          <div
            key={entry.rank}
            className={`flex items-center gap-4 px-4 rounded-sm border transition-all ${
              isChampion
                ? 'py-5 border-primary/50 bg-primary/5 animate-glow'
                : isPodium
                  ? 'py-4 border-border bg-card'
                  : 'py-3 border-border/50 bg-card/50'
            }`}
          >
            {/* Rank */}
            <div className={`font-display ${isChampion ? 'text-3xl' : isPodium ? 'text-2xl' : 'text-lg'} ${rankColor} w-12 text-center shrink-0`}>
              #{entry.rank}
            </div>

            {/* Name + Belt */}
            <div className="flex-1 min-w-0">
              <span className={`font-heading ${isChampion ? 'text-xl' : 'text-base'} truncate block`}>
                {entry.name}
              </span>
            </div>

            {/* Belt Badge */}
            <Badge className={`rounded-sm text-xs uppercase ${BELT_COLORS[entry.belt] || 'bg-muted text-muted-foreground'}`}>
              {entry.belt}
            </Badge>

            {/* Points */}
            <div className={`arena-stat font-mono ${isChampion ? 'text-2xl' : 'text-lg'} text-primary shrink-0`}>
              {entry.totalPoints}
              <span className="text-xs text-muted-foreground ml-1">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
