import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, HandCoins } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { QueryError } from '@/components/query-error';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatList, formatMoney, formatMonth } from '@/lib/format';
import { csvMoney, downloadCsv, type CsvRow } from '@/lib/csv';
import { FinanceTabs, MonthSwitcher, currentMonth } from './finance-nav';

export interface Payout {
  agreement: { id: string; name: string; sharePercent: number; active: boolean; teachers: { id: string; name: string }[] };
  addOn: { count: number; price: string | null; share: string; amount: string };
  recruited: { paid: string; percent: number; amount: string };
  suggested: string;
  confirmed: string | null;
  amount: string;
  missingCheckins: string[];
  walkIns: { studentId: string; name: string; checkins: number }[];
  students: {
    studentId: string;
    name: string;
    kind: 'addOn' | 'recruited';
    monthlyFee: string | null;
    checkins: number;
    paid: string;
    payout: string;
    payments: { amount: string; paymentDate: string; referenceMonth: string; payout: string }[];
  }[];
}

// One row per payment (an unpaid Student gets one empty row), then totals and the payout.
export function payoutCsvRows(p: Payout, month: string, t: TFunction | ((key: string) => string)): CsvRow[] {
  const fee = (v: string | null) => (v === null ? '' : csvMoney(v));
  const rows = p.students.flatMap((s) => {
    const kind = t(s.kind === 'addOn' ? 'finance.csv.kindAddOn' : 'finance.csv.kindRecruited');
    if (s.payments.length === 0) {
      return [[s.name, fee(s.monthlyFee), csvMoney(0), '', '', kind, csvMoney(0)]];
    }
    return s.payments.map((pay) => [
      s.name,
      fee(s.monthlyFee),
      csvMoney(pay.amount),
      pay.paymentDate,
      pay.referenceMonth,
      kind,
      csvMoney(pay.payout),
    ]);
  });
  const sum = (key: 'paid' | 'payout') => p.students.reduce((total, s) => total + Number(s[key]), 0);
  return [
    [p.agreement.name, month],
    [],
    [
      t('finance.csv.student'),
      t('finance.csv.monthlyFee'),
      t('finance.csv.paid'),
      t('finance.csv.paymentDate'),
      t('finance.csv.referenceMonth'),
      t('finance.csv.kind'),
      t('finance.csv.payout'),
    ],
    ...rows,
    [],
    [t('finance.csv.totalPaid'), '', csvMoney(sum('paid')), '', '', '', csvMoney(sum('payout'))],
    [t('finance.csv.suggested'), csvMoney(p.suggested)],
    [t('finance.csv.payoutAmount'), csvMoney(p.amount)],
  ];
}

function PayoutCard({ payout: p, month }: { payout: Payout; month: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(Number(p.amount).toFixed(2));
  const inputId = `payout-${p.agreement.id}`;
  const confirm = useMutation({
    mutationFn: () =>
      api('/finance/payouts', { method: 'POST', body: JSON.stringify({ agreementId: p.agreement.id, month, amount }) }),
    meta: { successMessage: t('finance.payouts.saved') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-payouts', month] });
      queryClient.invalidateQueries({ queryKey: ['finance-balance'] });
    },
  });
  const slug = p.agreement.name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();

  return (
    <article className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-lg bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="font-heading text-lg">{p.agreement.name}</h2>
            <span className="text-sm text-muted-foreground">
              {t('finance.payouts.sub', {
                teachers: p.agreement.teachers.map((teacher) => teacher.name).join(', '),
                percent: p.agreement.sharePercent,
              })}
            </span>
          </div>
          <span className="rounded-sm bg-muted px-2 py-1 text-xs">
            {t(p.confirmed === null ? 'finance.payouts.pending' : 'finance.payouts.confirmed')}
          </span>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          {p.addOn.price !== null && (
            <div className="flex justify-between gap-2">
              <dt>
                {t('finance.payouts.addOnLine', {
                  count: p.addOn.count,
                  percent: p.agreement.sharePercent,
                  price: formatMoney(p.addOn.price, locale),
                })}
              </dt>
              <dd className="font-mono">{formatMoney(p.addOn.amount, locale)}</dd>
            </div>
          )}
          {(p.addOn.price === null || p.students.some((s) => s.kind === 'recruited')) && (
            <div className="flex justify-between gap-2">
              <dt>
                {t('finance.payouts.recruitedLine', {
                  percent: p.recruited.percent,
                  paid: formatMoney(p.recruited.paid, locale),
                })}
              </dt>
              <dd className="font-mono">{formatMoney(p.recruited.amount, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2 text-muted-foreground">
            <dt>{t('finance.payouts.suggested')}</dt>
            <dd className="font-mono">{formatMoney(p.suggested, locale)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{t('finance.payouts.amountLabel')}</Label>
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={`${inputId}-hint`}
            className="h-12 font-mono text-lg font-bold"
          />
          <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {t('finance.payouts.amountHint')}
          </span>
        </div>
        {(p.missingCheckins.length > 0 || p.walkIns.length > 0) && (
          <div className="flex gap-2 rounded-md border border-warning-text/40 bg-warning-text/10 p-3 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-warning-text" aria-hidden />
            <div className="flex flex-col gap-1.5">
              {p.missingCheckins.length > 0 && (
                <p>
                  {t('finance.payouts.missingCheckins', {
                    name: p.agreement.name,
                    month: formatMonth(month, locale),
                    names: formatList(p.missingCheckins, locale),
                  })}
                </p>
              )}
              {p.walkIns.length > 0 && (
                <p>
                  {t('finance.payouts.walkIns', {
                    names: formatList(
                      p.walkIns.map((w) => t('finance.payouts.walkIn', { name: w.name, count: w.checkins })),
                      locale,
                    ),
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t('finance.payouts.ownerOnly')}</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button className="min-h-12 flex-1" disabled={amount === ''} loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {t('finance.payouts.confirm')}
          </Button>
          <Button
            variant="outline"
            className="min-h-12 flex-1"
            onClick={() => downloadCsv(`repasse-${slug}-${month}.csv`, payoutCsvRows(p, month, t))}
          >
            {t('finance.exportExcel')}
          </Button>
        </div>
      </section>

      <section aria-labelledby={`${inputId}-students`} className="overflow-hidden rounded-lg bg-card">
        <h3 id={`${inputId}-students`} className="px-4 pb-2 pt-3.5 font-heading text-sm uppercase">
          {t('finance.payouts.studentsOf', { name: p.agreement.name })}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-normal">{t('finance.payouts.student')}</th>
              <th className="px-2 py-2 text-right font-normal">{t('finance.payouts.paid')}</th>
              <th className="px-4 py-2 text-right font-normal">{t('finance.payouts.payout')}</th>
            </tr>
          </thead>
          <tbody>
            {p.students.map((s) => (
              <tr key={`${s.studentId}-${s.kind}`} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  {s.name}
                  <span className="block text-xs text-muted-foreground">
                    {`${t(s.kind === 'addOn' ? 'finance.payouts.kindAddOn' : 'finance.payouts.kindRecruited')} · ${t('finance.payouts.checkins', { count: s.checkins })}`}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {s.payments.length === 0 ? (
                    <span className="text-danger-text">{t('finance.payouts.notPaid')}</span>
                  ) : (
                    formatMoney(s.paid, locale)
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{formatMoney(s.payout, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}

export default function PayoutsPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const { data: payouts = [], isLoading, isError, refetch } = useApiQuery<Payout[]>(
    ['finance-payouts', month],
    `/finance/payouts?month=${month}`,
  );

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <MonthSwitcher month={month} onChange={setMonth} />
      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t('finance.payouts.empty')}
          description={t('finance.payouts.emptyDescription')}
          help="Acréscimo e Angariado"
        />
      ) : (
        payouts.map((p) => (
          <PayoutCard key={`${p.agreement.id}-${p.amount}`} payout={p} month={month} />
        ))
      )}
    </div>
  );
}
