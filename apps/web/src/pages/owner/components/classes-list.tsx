import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApiQuery } from '@/hooks/use-api';

type ClassType = 'gi' | 'no-gi' | 'open-mat' | 'kids';

interface ClassRow {
  classId: string;
  name: string;
  type: string;
  startTime?: string | null;
  endTime?: string | null;
  totalCheckins: number;
  uniqueStudents: number;
  occurrences: number;
  avgPerOccurrence: number;
  trend: number | null;
}

const PAGE_SIZE = 10;
const TYPE_FILTERS: Array<'all' | ClassType> = ['all', 'gi', 'no-gi', 'open-mat', 'kids'];

function formatTime(t?: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

function TrendArrow({ trend }: { trend: number | null }) {
  if (trend == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (trend >= 1.1) {
    return (
      <span className="text-green-600">↑ +{Math.round((trend - 1) * 100)}%</span>
    );
  }
  if (trend < 0.9) {
    return (
      <span className="text-red-600">↓ -{Math.round((1 - trend) * 100)}%</span>
    );
  }
  return <span className="text-muted-foreground">→</span>;
}

export function ClassesList({
  classes,
  from,
  to,
}: {
  classes: ClassRow[];
  period: string;
  from: string;
  to: string;
}) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | ClassType>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => (typeFilter === 'all' ? classes : classes.filter((c) => c.type === typeFilter)),
    [classes, typeFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleTypeChange(next: 'all' | ClassType) {
    setTypeFilter(next);
    setPage(1);
    setExpandedId(null);
  }

  return (
    <div className="divide-y">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('owner.classes.title')}
        </span>
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleTypeChange(f)}
              className={`px-2 py-1 rounded text-xs ${
                typeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {f === 'all' ? t('owner.classes.allTypes') : t(`owner.classes.types.${f}`)}
            </button>
          ))}
        </div>
      </div>
      {pageSlice.length === 0 && (
        <div className="px-2 py-6 text-sm text-muted-foreground text-center">
          {t('owner.classes.noClasses')}
        </div>
      )}
      {pageSlice.map((c) => (
        <div key={c.classId}>
          <button
            type="button"
            className="w-full flex justify-between items-center px-2 py-3 hover:bg-muted/50 text-left"
            onClick={() =>
              setExpandedId((id) => (id === c.classId ? null : c.classId))
            }
          >
            <span className="font-medium">
              {c.name}{' '}
              <span className="text-xs text-muted-foreground">· {c.type}</span>
              {c.startTime && (
                <span className="text-xs text-muted-foreground">
                  {' '}
                  · {formatTime(c.startTime)}
                  {c.endTime ? `–${formatTime(c.endTime)}` : ''}
                </span>
              )}
            </span>
            <span className="flex gap-4 items-center text-sm">
              <span>{c.totalCheckins}</span>
              <span className="text-muted-foreground">·</span>
              <TrendArrow trend={c.trend} />
            </span>
          </button>
          {expandedId === c.classId && (
            <ClassExpansion classId={c.classId} from={from} to={to} />
          )}
        </div>
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded bg-muted disabled:opacity-40"
          >
            {t('owner.classes.pagePrev')}
          </button>
          <span className="text-muted-foreground">
            {t('owner.classes.pageStatus', { page: safePage, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded bg-muted disabled:opacity-40"
          >
            {t('owner.classes.pageNext')}
          </button>
        </div>
      )}
    </div>
  );
}

function ClassExpansion({
  classId,
  from,
  to,
}: {
  classId: string;
  from: string;
  to: string;
}) {
  const { t } = useTranslation();
  const { data: occ } = useApiQuery<{
    occurrences: { date: string; checkins: number; uniqueStudents: number }[];
  }>(
    ['owner', 'class', classId, 'occurrences', from, to],
    `/owner/classes/${classId}/occurrences?from=${from}&to=${to}`,
    !!from && !!to,
  );
  const latestDate = occ?.occurrences?.[occ.occurrences.length - 1]?.date;
  const { data: roster } = useApiQuery<{
    students: { id: string; name: string; belt: string }[];
  }>(
    ['owner', 'class', classId, 'roster', latestDate ?? ''],
    `/owner/classes/${classId}/occurrences/${latestDate}/roster`,
    !!latestDate,
  );
  return (
    <div className="px-4 py-3 bg-muted/30 space-y-3">
      <div data-testid="occurrence-chart" className="w-full h-32">
        <ResponsiveContainer>
          <LineChart data={occ?.occurrences ?? []}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="checkins" stroke="var(--chart-2)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {t('owner.classes.roster')} · {latestDate ?? '—'}
        </div>
        <ul className="text-sm">
          {roster?.students.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <span className="text-muted-foreground"> · {s.belt}</span>
            </li>
          ))}
          {roster && roster.students.length === 0 && (
            <li className="text-muted-foreground">{t('owner.classes.noRoster')}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
