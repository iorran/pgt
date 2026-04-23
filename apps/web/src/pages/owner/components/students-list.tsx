interface StudentRow {
  id: string;
  name: string;
  belt: string;
  lastCheckinAt: string | null;
  daysSinceCheckin: number | null;
  status: 'active' | 'slowing' | 'drifting' | 'inactive';
}

export function StudentsList({ students }: { students: StudentRow[] }) {
  return (
    <div>
      <div className="px-2 py-2 text-sm font-medium text-muted-foreground">Students</div>
      <ul className="divide-y">
        {students.map((s) => (
          <li key={s.id} className="px-2 py-3">
            <span>{s.name}</span> — {s.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
