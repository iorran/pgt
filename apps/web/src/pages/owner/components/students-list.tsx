import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';

type Status = 'active' | 'slowing' | 'drifting' | 'inactive';
interface StudentRow {
  id: string;
  name: string;
  belt: string;
  lastCheckinAt: string | null;
  daysSinceCheckin: number | null;
  status: Status;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'slowing', label: 'Slowing' },
  { key: 'drifting', label: 'Drifting' },
  { key: 'inactive', label: 'Inactive' },
] as const;

const statusColor: Record<Status, string> = {
  active: 'text-green-600',
  slowing: 'text-amber-600',
  drifting: 'text-red-600',
  inactive: 'text-muted-foreground',
};

export function StudentsList({ students }: { students: StudentRow[] }) {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.key] =
      f.key === 'all'
        ? students.length
        : students.filter((s) => s.status === f.key).length;
    return acc;
  }, {});
  const visible =
    filter === 'all' ? students : students.filter((s) => s.status === filter);

  return (
    <div className="divide-y">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-sm font-medium text-muted-foreground">Students</span>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key as 'all' | Status)}
              className={`px-2 py-1 rounded text-xs ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {f.label} {counts[f.key] ?? 0}
            </button>
          ))}
        </div>
      </div>
      {visible.map((s) => (
        <div key={s.id}>
          <button
            type="button"
            className="w-full flex justify-between items-center px-2 py-3 hover:bg-muted/50 text-left"
            onClick={() => setExpandedId((id) => (id === s.id ? null : s.id))}
          >
            <span>
              <span>{s.name}</span>{' '}
              <span className="text-xs text-muted-foreground">· {s.belt}</span>
            </span>
            <span className={`text-sm ${statusColor[s.status]}`}>
              {s.status}
              {s.daysSinceCheckin != null ? ` · ${s.daysSinceCheckin}d` : ''}
            </span>
          </button>
          {expandedId === s.id && <StudentExpansion studentId={s.id} />}
        </div>
      ))}
    </div>
  );
}

function StudentExpansion({ studentId }: { studentId: string }) {
  const from = isoDaysAgo(30);
  const to = isoDaysAgo(-1);
  const { data } = useApiQuery<{
    student: { id: string; name: string; belt: string };
    checkins: { date: string; class: { name: string; type: string } | null }[];
    stats: {
      total: number;
      uniqueClasses: number;
      currentStreak: number;
      longestStreak: number;
    };
  }>(
    ['owner', 'student', studentId, 'history', from, to],
    `/owner/students/${studentId}/history?from=${from}&to=${to}`,
    true,
  );
  if (!data) {
    return <div className="px-4 py-3 bg-muted/30 text-sm">Loading…</div>;
  }
  return (
    <div className="px-4 py-3 bg-muted/30 space-y-2 text-sm">
      <div className="flex gap-4 text-xs">
        <span>Total: {data.stats.total}</span>
        <span>Classes: {data.stats.uniqueClasses}</span>
        <span>Streak: {data.stats.currentStreak}</span>
        <span>Best: {data.stats.longestStreak}</span>
      </div>
      <ul>
        {data.checkins.map((c, i) => (
          <li key={i}>
            {c.date} · {c.class?.name ?? '—'}
          </li>
        ))}
        {data.checkins.length === 0 && (
          <li className="text-muted-foreground">
            No check-ins in the last 30 days.
          </li>
        )}
      </ul>
    </div>
  );
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
