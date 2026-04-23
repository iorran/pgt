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

export function ClassesList({
  classes,
}: {
  classes: ClassRow[];
  period: string;
  from: string;
  to: string;
}) {
  return (
    <div>
      <div className="px-2 py-2 text-sm font-medium text-muted-foreground">Classes</div>
      <ul className="divide-y">
        {classes.map((c) => (
          <li key={c.classId} className="px-2 py-3">
            {c.name} — {c.totalCheckins}
          </li>
        ))}
      </ul>
    </div>
  );
}
