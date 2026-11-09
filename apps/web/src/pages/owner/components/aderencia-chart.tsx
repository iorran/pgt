import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { InfoTip } from '@/components/info-tip';

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

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ClassRow;
  index?: number;
}

function BarShape(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload, index = 0 } = props;
  if (!payload) {
    return null;
  }
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={CHART_COLORS[index % CHART_COLORS.length]}
      data-testid={`aderencia-chart-bar-${payload.classId}`}
    />
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ClassRow }>;
}

function AderenciaTooltip({ active, payload }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) {
    return null;
  }
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-background p-2 text-xs shadow">
      <div className="font-medium">{d.name}</div>
      <div>{t('owner.chart.total')}: {d.totalCheckins}</div>
      <div>{t('owner.chart.uniqueStudents')}: {d.uniqueStudents}</div>
      <div>{t('owner.chart.avgPerOccurrence')}: {d.avgPerOccurrence.toFixed(1)}</div>
      <div>
        {t('owner.chart.trend')}: {d.trend == null ? '—' : `${(d.trend * 100).toFixed(0)}%`}
      </div>
    </div>
  );
}

export function AderenciaChart({ data }: { data: ClassRow[] }) {
  const { t } = useTranslation();
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('owner.chart.empty')}</p>;
  }
  // Horizontal bars: class names sit on the y axis at full width instead of
  // overlapping under each other on a phone.
  return (
    <div className="w-full" data-testid="aderencia-chart">
      <div className="flex justify-end">
        <InfoTip label={t('infoTip.aderencia.label')} text={t('infoTip.aderencia.text')} section="Painel da Academia" />
      </div>
      <div style={{ height: data.length * 44 + 32 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 12 }} interval={0} />
            <Tooltip content={<AderenciaTooltip />} cursor={{ fill: 'var(--muted)' }} />
            <Bar dataKey="totalCheckins" shape={<BarShape />} barSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
