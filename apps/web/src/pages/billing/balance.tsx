import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Download } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import { formatMoney, formatMonth } from '@/lib/format';
import { csvMoney, downloadCsv, type CsvRow } from '@/lib/csv';
import { FinanceTabs, MonthSwitcher, currentMonth } from './finance-nav';

export interface Balance {
  month: string;
  income: {
    monthlyFees: { amount: string; students: number };
    addOns: { amount: string; count: number };
    seminars: { amount: string; count: number };
    total: string;
  };
  expenses: { total: string; items: { description: string; amount: string }[] };
  payouts: { total: string };
  result: string;
  history: { month: string; result: string }[];
}

export function balanceCsvRows(b: Balance, t: TFunction | ((key: string) => string)): CsvRow[] {
  return [
    [t('finance.csv.month'), b.month],
    [],
    [t('finance.csv.monthlyFees'), csvMoney(b.income.monthlyFees.amount)],
    [t('finance.csv.addOns'), csvMoney(b.income.addOns.amount)],
    [t('finance.csv.seminars'), csvMoney(b.income.seminars.amount)],
    [t('finance.csv.income'), csvMoney(b.income.total)],
    [],
    [t('finance.csv.expense'), t('finance.csv.amount')],
    ...b.expenses.items.map((e) => [e.description, csvMoney(e.amount)]),
    [t('finance.csv.expenses'), csvMoney(b.expenses.total)],
    [],
    [t('finance.csv.payouts'), csvMoney(b.payouts.total)],
    [t('finance.csv.result'), csvMoney(b.result)],
  ];
}

const signedMoney = (value: string | number, locale: string) =>
  `${Number(value) < 0 ? '−' : '+'} ${formatMoney(Math.abs(Number(value)), locale)}`;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function Bar({ label, amount, width, color }: { label: string; amount: string; width: number; color: string }) {
  const { i18n } = useTranslation();
  return (
    <li className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono">{formatMoney(amount, i18n.language)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="font-heading text-base uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function BalancePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [month, setMonth] = useState(currentMonth);
  const { data: b, isLoading, isError, refetch } = useApiQuery<Balance>(
    ['finance-balance', month],
    `/finance/balance?month=${month}`,
  );

  if (isLoading) {
    return <PageLoader />;
  }

  const income = Number(b?.income.total ?? 0);
  const spent = Number(b?.expenses.total ?? 0);
  const paidOut = Number(b?.payouts.total ?? 0);
  // When more went out than came in, the bar is the money that went out.
  const base = Math.max(income, spent + paidOut);
  const where = { expenses: pct(spent, base), payouts: pct(paidOut, base) };
  const kept = Math.max(0, 100 - where.expenses - where.payouts);
  const incomeRows = b
    ? [
        {
          label: t('finance.balance.monthlyFees', { count: b.income.monthlyFees.students }),
          amount: b.income.monthlyFees.amount,
          color: 'bg-primary',
        },
        {
          label: t('finance.balance.seminars', { count: b.income.seminars.count }),
          amount: b.income.seminars.amount,
          color: 'bg-seminar',
        },
        {
          label: t('finance.balance.addOns', { count: b.income.addOns.count }),
          amount: b.income.addOns.amount,
          color: 'bg-primary',
        },
      ]
    : [];
  const maxIncome = Math.max(...incomeRows.map((r) => Number(r.amount)), 0);
  const top = b?.expenses.items.slice(0, 4) ?? [];
  const maxExpense = Math.max(...top.map((e) => Number(e.amount)), 0);
  const maxResult = Math.max(...(b?.history ?? []).map((h) => Math.abs(Number(h.result))), 0);
  const previous = b?.history[b.history.length - 2];
  const shortMonth = (ym: string) =>
    new Date(`${ym}-01T00:00`).toLocaleDateString(locale.startsWith('pt') ? 'pt-PT' : locale, { month: 'short' });

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <MonthSwitcher month={month} onChange={setMonth} />
      {isError || !b ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-lg bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('finance.balance.result')}</p>
            <p className={`arena-stat text-4xl ${Number(b.result) < 0 ? 'text-danger-text' : 'text-primary'}`}>
              {signedMoney(b.result, locale)}
            </p>
            {previous && (
              <p className="text-sm text-muted-foreground">
                {t('finance.balance.vsPrevious', {
                  amount: signedMoney(Number(b.result) - Number(previous.result), locale),
                  month: formatMonth(previous.month, locale),
                })}
              </p>
            )}
          </section>

          <section className="grid grid-cols-3 gap-2">
            {[
              { label: t('finance.balance.in'), value: b.income.total },
              { label: t('finance.balance.expenses'), value: b.expenses.total },
              { label: t('finance.balance.payouts'), value: b.payouts.total },
            ].map((x) => (
              <div key={x.label} className="flex flex-col gap-1 rounded-lg bg-card p-3">
                <span className="text-xs text-muted-foreground">{x.label}</span>
                <span className="font-mono text-sm font-bold">{formatMoney(x.value, locale)}</span>
              </div>
            ))}
          </section>

          {base > 0 && (
            <Section id="fin-where" title={t('finance.balance.whereTitle')}>
              <div
                role="img"
                aria-label={t('finance.balance.whereLabel', { expenses: where.expenses, payouts: where.payouts, kept })}
                className="flex h-7 overflow-hidden rounded-md bg-muted"
              >
                <div className="bg-finance-expense" style={{ width: `${where.expenses}%` }} />
                <div className="bg-finance-payout" style={{ width: `${where.payouts}%` }} />
                <div className="bg-primary" style={{ width: `${kept}%` }} />
              </div>
              <ul className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {[
                  { label: t('finance.balance.expenses'), value: where.expenses, color: 'bg-finance-expense' },
                  { label: t('finance.balance.payouts'), value: where.payouts, color: 'bg-finance-payout' },
                  { label: t('finance.balance.kept'), value: kept, color: 'bg-primary' },
                ].map((x) => (
                  <li key={x.label} className="flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-sm ${x.color}`} aria-hidden />
                    {x.label} {x.value}%
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="fin-income" title={t('finance.balance.incomeTitle')}>
            <ul className="flex flex-col gap-2.5">
              {incomeRows.map((r) => (
                <Bar key={r.label} label={r.label} amount={r.amount} width={pct(Number(r.amount), maxIncome)} color={r.color} />
              ))}
            </ul>
          </Section>

          <Section
            id="fin-top"
            title={t('finance.balance.topExpenses')}
            action={
              <Link to="/billing/expenses" className="text-sm font-semibold text-primary">
                {t('finance.balance.seeAll')}
              </Link>
            }
          >
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('finance.balance.noExpenses')}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {top.map((e, i) => (
                  <Bar
                    key={`${e.description}-${i}`}
                    label={e.description}
                    amount={e.amount}
                    width={pct(Number(e.amount), maxExpense)}
                    color="bg-finance-expense"
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section id="fin-history" title={t('finance.balance.historyTitle')}>
            <div
              role="img"
              aria-label={t('finance.balance.historyLabel', {
                list: b.history.map((h) => `${formatMonth(h.month, locale)} ${formatMoney(h.result, locale)}`).join(', '),
              })}
              className="grid h-28 grid-cols-6 items-end gap-2"
            >
              {b.history.map((h) => (
                <div
                  key={h.month}
                  className={`rounded-t-sm ${
                    Number(h.result) < 0 ? 'bg-destructive' : h.month === month ? 'bg-primary' : 'bg-primary/35'
                  }`}
                  style={{ height: `${pct(Math.abs(Number(h.result)), maxResult)}%` }}
                />
              ))}
            </div>
            {/* Signed values, so a loss is not told by colour alone. */}
            <div className="grid grid-cols-6 gap-2 text-center font-mono text-[11px]" aria-hidden>
              {b.history.map((h) => (
                <span key={h.month} className={Number(h.result) < 0 ? 'text-danger-text' : 'text-muted-foreground'}>
                  {Number(h.result) > 0 ? '+' : ''}
                  {Number(h.result).toLocaleString(locale, { notation: 'compact', maximumFractionDigits: 1 })}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 text-center text-xs text-muted-foreground" aria-hidden>
              {b.history.map((h) => (
                <span key={h.month} className={h.month === month ? 'font-bold text-foreground' : undefined}>
                  {shortMonth(h.month)}
                </span>
              ))}
            </div>
          </Section>

          <Button
            variant="outline"
            className="min-h-12 w-full"
            onClick={() => downloadCsv(`balanco-${month}.csv`, balanceCsvRows(b, t))}
          >
            <Download aria-hidden />
            {t('finance.balance.export')}
          </Button>
        </>
      )}
    </div>
  );
}
