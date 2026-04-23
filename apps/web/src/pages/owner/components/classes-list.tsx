import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApiQuery } from '@/hooks/use-api';

interface ClassRow {
  classId: string;
  name: string;
  type: string;
  totalCheckins: number;
  uniqueStudents: number;
  occurrences: number;
  avgPerOccurrence: number;
  trend: number | null;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="divide-y">
      <div className="px-2 py-2 text-sm font-medium text-muted-foreground">Classes</div>
      {classes.map((c) => (
        <div key={c.classId}>
          <button
            type="button"
            className="w-full flex justify-between items-center px-2 py-3 hover:bg-muted/50 text-left"
            onClick={() =>
              setExpandedId((id) => (id === c.classId ? null : c.classId))
            }
          >
            <span className="font-medium">
              {c.name} <span className="text-xs text-muted-foreground">· {c.type}</span>
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
            <Line type="monotone" dataKey="checkins" stroke="hsl(var(--primary))" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">
          Roster · {latestDate ?? '—'}
        </div>
        <ul className="text-sm">
          {roster?.students.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <span className="text-muted-foreground"> · {s.belt}</span>
            </li>
          ))}
          {roster && roster.students.length === 0 && (
            <li className="text-muted-foreground">No check-ins yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
