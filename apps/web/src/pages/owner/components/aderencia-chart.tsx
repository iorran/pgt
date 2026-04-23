import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: ClassRow;
}

function BarShape(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) {
    return null;
  }
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="hsl(var(--primary))"
      data-testid={`aderencia-chart-bar-${payload.classId}`}
    />
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ClassRow }>;
}

function AderenciaTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-background p-2 text-xs shadow">
      <div className="font-medium">{d.name}</div>
      <div>Total: {d.totalCheckins}</div>
      <div>Unique students: {d.uniqueStudents}</div>
      <div>Avg/occurrence: {d.avgPerOccurrence.toFixed(1)}</div>
      <div>Trend: {d.trend == null ? '—' : `${(d.trend * 100).toFixed(0)}%`}</div>
    </div>
  );
}

export function AderenciaChart({ data }: { data: ClassRow[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No check-ins in this period.</p>;
  }
  return (
    <div className="w-full h-72" data-testid="aderencia-chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-15}
            textAnchor="end"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip content={<AderenciaTooltip />} />
          <Bar dataKey="totalCheckins" shape={<BarShape />} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
