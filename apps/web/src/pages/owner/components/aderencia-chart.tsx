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

export function AderenciaChart({ data }: { data: ClassRow[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No check-ins in this period.</p>;
  }
  return (
    <div data-testid="aderencia-chart">
      {data.map((d) => (
        <span key={d.classId} className="inline-block mr-2">
          <span>{d.name}</span>: {d.totalCheckins}
        </span>
      ))}
    </div>
  );
}
