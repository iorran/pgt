import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HandCoins } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { QueryError } from '@/components/query-error';
import { EmptyState } from '@/components/empty-state';
import { formatMoney, formatMonth, formatShortMonth, shiftMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FinanceTabs, currentMonth } from './finance-nav';
import { SheetStatus, type PayoutSheetStatus } from './payout-sheet';

interface SheetSummary {
  className: string;
  teachers: string[];
  students: number;
  total: string | null;
  status: PayoutSheetStatus;
}

interface HistoryMonth {
  month: string;
  classes: { className: string; total: string }[];
  confirmed: boolean;
}

// One colour per class name, the same in the bars and the legend.
const CLASS_COLORS = [
  'bg-arena-cyan',
  'bg-finance-expense',
  'bg-arena-purple',
  'bg-arena-accent',
  'bg-belt-blue',
  'bg-arena-red',
];

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

function HistoryChart({
  history,
  month,
  onPick,
}: {
  history: HistoryMonth[];
  month: string;
  onPick: (m: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const names = [...new Set(history.flatMap((h) => h.classes.map((c) => c.className)))];
  const color = (name: string) => CLASS_COLORS[names.indexOf(name) % CLASS_COLORS.length];
  const totals = history.map((h) => h.classes.reduce((sum, c) => sum + Number(c.total), 0));
  const max = Math.max(...totals, 0);
  const average = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const describe = (h: HistoryMonth) =>
    `${formatMonth(h.month, locale)}: ${h.classes.map((c) => `${c.className} ${formatMoney(c.total, locale)}`).join(', ')}`;

  return (
    <section aria-labelledby="payout-history" className="flex flex-col gap-3 rounded-lg bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="payout-history" className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
          {t('finance.sheets.historyTitle')}
        </h2>
        <span className="font-mono text-sm">
          {t('finance.sheets.average', {
            amount: formatMoney(average, locale),
          })}
        </span>
      </div>
      <div className="flex h-36 items-end gap-2">
        {history.map((h, i) => (
          <button
            key={h.month}
            type="button"
            aria-label={t('finance.sheets.barLabel', { list: describe(h) })}
            aria-pressed={h.month === month}
            onClick={() => onPick(h.month)}
            className={cn(
              'flex h-full min-w-11 flex-1 flex-col items-center justify-end gap-1',
              !h.confirmed && 'opacity-55',
            )}
          >
            <span className="font-mono text-[10px] text-muted-foreground">{Math.round(totals[i])} €</span>
            <span className="flex h-24 w-full flex-col justify-end gap-0.5">
              {[...h.classes].reverse().map((c) => (
                <span
                  key={c.className}
                  className={cn('w-full first:rounded-t-sm', color(c.className))}
                  style={{ height: `${pct(Number(c.total), max)}%` }}
                />
              ))}
            </span>
            <span
              className={cn('text-xs', h.month === month ? 'font-semibold text-arena-accent' : 'text-muted-foreground')}
            >
              {formatShortMonth(h.month, locale)}
            </span>
          </button>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', color(name))} aria-hidden />
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PayoutSheetsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [month, setMonth] = useState(currentMonth);
  const {
    data: sheets = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<SheetSummary[]>(['payout-sheets', month], `/payout-sheets?month=${month}`);
  const { data: newestFirst = [] } = useApiQuery<HistoryMonth[]>(['payout-history'], '/payout-sheets/history?months=6');
  // The API sends newest first; the chart reads left to right.
  const history = [...newestFirst].reverse();
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth(), -i));

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {t('finance.sheets.month')}
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-11 rounded-sm border border-border bg-card px-3 text-base text-foreground capitalize"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m, locale)}
            </option>
          ))}
        </select>
      </label>
      {history.length > 0 && <HistoryChart history={history} month={month} onPick={setMonth} />}
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : sheets.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t('finance.sheets.empty')}
          description={t('finance.sheets.emptyDescription')}
          help="Repasses"
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {sheets.map((s) => (
              <li key={s.className}>
                <Link
                  to={`/billing/payouts/${month}/${encodeURIComponent(s.className)}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3.5"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-heading text-lg">{s.className}</span>
                    <span className="text-sm text-muted-foreground">
                      {[s.teachers.join(', '), t('finance.sheets.students', { count: s.students })]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono font-bold">{s.total === null ? '—' : formatMoney(s.total, locale)}</span>
                    <SheetStatus status={s.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t('finance.sheets.hint')}</p>
        </>
      )}
    </div>
  );
}
