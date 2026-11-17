import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { SubpageHeader } from '@/components/subpage-header';
import { formatMoney, formatMonth, formatShortMonth, toLocale } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SheetStatus, type PayoutSheet } from '@/pages/billing/payout-sheet';

interface MyClass {
  className: string;
  history: { month: string; total: string | null; confirmed: boolean }[];
}

// What a Class Teacher sees of their Payout Sheets (ADR 0007): read-only, never a Monthly Fee.
export default function MyPayoutPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: classes = [], isLoading } = useApiQuery<MyClass[]>(['my-payout-sheets'], '/me/payout-sheets');
  const [picked, setPicked] = useState<{ className?: string; month?: string }>({});
  const current = classes.find((c) => c.className === picked.className) ?? classes[0];
  // The API sends newest first; the chart reads left to right.
  const history = [...(current?.history ?? [])].reverse();
  const month = picked.month ?? history[history.length - 1]?.month;
  const { data: sheet } = useApiQuery<PayoutSheet>(
    ['my-payout-sheet', month ?? '', current?.className ?? ''],
    `/me/payout-sheets/${month}/${encodeURIComponent(current?.className ?? '')}`,
    !!current && !!month,
  );
  const max = Math.max(...history.map((h) => Number(h.total ?? 0)), 0);

  if (isLoading) {
    return <p className="text-muted-foreground">{t('common.loading')}</p>;
  }
  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <SubpageHeader title={t('myPayout.entry')} />
        <p className="text-sm text-muted-foreground">{t('myPayout.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <SubpageHeader title={t('myPayout.title', { name: current.className })} />
          {month && <span className="text-sm text-muted-foreground capitalize">{formatMonth(month, locale)}</span>}
        </div>
        {sheet && (
          <SheetStatus
            status={sheet.status}
            className="mt-3 rounded-sm border border-current px-2 py-0.5 font-heading uppercase"
          />
        )}
      </div>

      {classes.length > 1 && (
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {t('myPayout.class')}
          <select
            value={current.className}
            onChange={(e) => setPicked({ className: e.target.value })}
            className="h-11 rounded-sm border border-border bg-card px-3 text-base text-foreground"
          >
            {classes.map((c) => (
              <option key={c.className} value={c.className}>
                {c.className}
              </option>
            ))}
          </select>
        </label>
      )}

      <section
        aria-labelledby="my-payout-history"
        className="flex flex-col gap-2.5 rounded-sm border border-border bg-card p-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="my-payout-history" className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            {t('myPayout.historyTitle')}
          </h2>
          <span className="text-xs text-muted-foreground">{t('myPayout.tapHint')}</span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {history.map((h) => {
            const amount = h.total === null ? '—' : formatMoney(h.total, locale);
            return (
              <button
                key={h.month}
                type="button"
                aria-label={t(h.confirmed ? 'myPayout.bar' : 'myPayout.barDraft', {
                  month: formatMonth(h.month, locale),
                  amount,
                })}
                aria-pressed={h.month === month}
                onClick={() => setPicked({ className: current.className, month: h.month })}
                className="flex h-full min-w-11 flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {h.total === null
                    ? '—'
                    : Number(h.total).toLocaleString(toLocale(locale), {
                        minimumFractionDigits: 2,
                      })}
                </span>
                <span className="flex h-20 w-full items-end">
                  <span
                    className={cn(
                      'w-full rounded-t-sm',
                      h.confirmed ? 'bg-arena-accent' : 'border-2 border-dashed border-arena-accent',
                    )}
                    style={{
                      height: `${max > 0 ? (Number(h.total ?? 0) / max) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    'text-xs',
                    h.month === month ? 'font-semibold text-arena-accent' : 'text-muted-foreground',
                  )}
                >
                  {formatShortMonth(h.month, locale)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {sheet && sheet.status !== 'confirmed' && (
        <p className="rounded-sm border border-warning-text p-3 text-sm text-warning-text">
          {t('myPayout.draft', { month: formatMonth(sheet.month, locale) })}
        </p>
      )}

      {sheet && (
        <>
          <table className="w-full text-[15px]">
            <thead>
              <tr className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 text-left font-medium">{t('myPayout.student')}</th>
                <th className="px-1 py-2 text-center font-medium">{t('myPayout.checkins')}</th>
                <th className="px-1 py-2 text-left font-medium">{t('myPayout.paid')}</th>
                <th className="py-2 text-right font-medium">{t('myPayout.payout')}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => (
                <tr key={r.studentId} className="border-t border-border">
                  <td className="py-3 font-semibold">{r.name}</td>
                  <td className="px-1 py-3 text-center font-mono">{r.checkins}</td>
                  <td className={cn('px-1 py-3', r.paid ? 'text-success-text' : 'text-warning-text')}>
                    {t(r.paid ? 'myPayout.yes' : 'myPayout.no')}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {r.amount === null ? '—' : formatMoney(r.amount, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4">
            <span className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
              {t('myPayout.total')}
            </span>
            <span className="font-mono text-2xl font-bold">{formatMoney(sheet.total ?? 0, locale)}</span>
          </div>
        </>
      )}
    </div>
  );
}
