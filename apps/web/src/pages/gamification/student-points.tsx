import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { isOwner, isStudent } from '@/lib/roles';
import { beltClasses, beltKey } from '@/lib/belts';
import { PageLoader } from '@/components/page-loader';
import { Badge } from '@/components/ui/badge';
import { SubpageHeader } from '../me/subpage-header';
import { AdjustPointsDialog, ResultRow, type CompetitionResult } from './result-control';

interface Season {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  belt?: string;
}

// Every entry behind a student's ranking points, for the owner to fix (from Classificação).
export default function StudentPointsPage() {
  const { t } = useTranslation();
  const { studentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session } = useSession();
  const user = session?.user as any;
  const owner = isOwner(user);

  const { data: seasons = [], isLoading } = useApiQuery<Season[]>(
    ['seasons', user?.academyId],
    `/seasons?academyId=${user?.academyId}`,
    owner && !!user?.academyId,
  );
  // Same default as the leaderboard: the first season.
  const seasonId = searchParams.get('seasonId') || seasons[0]?.id || '';

  const { data: student } = useApiQuery<Student>(['student', studentId], `/students/${studentId}`, owner);
  const { data: entries = [], isLoading: entriesLoading } = useApiQuery<CompetitionResult[]>(
    ['competition-results', seasonId, 'student', studentId],
    `/competition-results?seasonId=${seasonId}&studentId=${studentId}`,
    owner && !!seasonId,
  );

  if (isStudent(user)) {
    return <Navigate to="/gamification" replace />;
  }
  if (isLoading) {
    return <PageLoader />;
  }

  const total = entries.filter((r) => r.status === 'approved').reduce((sum, r) => sum + (r.pointsAwarded ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SubpageHeader title={student?.name ?? ''} to="/gamification" />
        <div className="flex items-center gap-3">
          {student?.belt && <Badge className={`rounded-sm text-xs uppercase ${beltClasses(student.belt)}`}>{t(beltKey(student.belt))}</Badge>}
          <p className="arena-stat font-mono text-lg text-primary">
            {total}
            <span className="ml-1 text-xs text-muted-foreground">{t('gamification.pointsShort')}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {seasons.length > 1 && (
          <select
            value={seasonId}
            onChange={(e) => setSearchParams({ seasonId: e.target.value }, { replace: true })}
            aria-label={t('gamification.season')}
            className="min-h-11 rounded-sm border border-border bg-card px-3 py-2 text-sm font-heading"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {student && <AdjustPointsDialog student={student} className="w-full sm:w-auto" />}
      </div>

      {entriesLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground">{t('common.noResults')}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((r) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
