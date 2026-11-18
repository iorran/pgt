import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { QueryError } from '@/components/query-error';
import { SubpageHeader } from '@/components/subpage-header';
import { SearchCombobox, type SearchItem } from '@/components/search-combobox';
import { Button } from '@/components/ui/button';
import { formatMoney, formatMonth, toLocale } from '@/lib/format';
import { cn } from '@/lib/utils';

export type PayoutSheetStatus = 'empty' | 'draft' | 'confirmed';

// One Payout Sheet (ADR 0007). Teachers get the same rows without monthlyFee.
export interface PayoutSheet {
  className: string;
  month: string;
  status: PayoutSheetStatus;
  teachers: string[];
  total: string | null;
  rows: {
    studentId: string;
    name: string;
    belt: string;
    checkins: number;
    paid: boolean;
    monthlyFee?: string | null;
    amount: string | null;
    addedByHand: boolean;
  }[];
}

const STATUS_COLOR: Record<PayoutSheetStatus, string> = {
  empty: 'text-muted-foreground',
  draft: 'text-warning-text',
  confirmed: 'text-success-text',
};

export function SheetStatus({ status, className }: { status: PayoutSheetStatus; className?: string }) {
  const { t } = useTranslation();
  return <span className={cn('text-xs', STATUS_COLOR[status], className)}>{t(`finance.sheets.status.${status}`)}</span>;
}

// What the Owner types ("12,5", "12.50", "") as the API's decimal string, or null when empty.
// Undefined means it is not a valid amount.
export function parseAmount(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : undefined;
}

export default function PayoutSheetPage() {
  const { t, i18n } = useTranslation();
  const { month = '', className = '' } = useParams<{
    month: string;
    className: string;
  }>();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <SubpageHeader title={t('finance.sheets.title', { name: className })} to="/billing/payouts" />
        <span className="text-sm text-muted-foreground capitalize">{formatMonth(month, i18n.language)}</span>
      </div>
      <PayoutSheetBody month={month} className={className} />
    </div>
  );
}

// The rows, the add-student picker, the total and Confirmar/Reabrir of one sheet — on its own page or
// inline on the Repasses tab.
export function PayoutSheetBody({ month, className }: { month: string; className: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: session } = useSession();
  const academyId = (session?.user as { academyId?: string } | undefined)?.academyId;
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const path = `/payout-sheets/${month}/${encodeURIComponent(className)}`;
  const {
    data: sheet,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<PayoutSheet>(['payout-sheet', month, className], path);
  const { data: students = [] } = useApiQuery<SearchItem[]>(
    ['students', academyId ?? ''],
    `/students?academyId=${academyId}`,
    adding && !!academyId,
  );

  const onSuccess = () => {
    // Only this sheet refetches its rows; the other open sheets stay as they are.
    queryClient.invalidateQueries({ queryKey: ['payout-sheet', month, className] });
    for (const key of ['payout-sheets', 'payout-history', 'finance-balance']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const save = useMutation({
    mutationFn: ({ studentId, amount }: { studentId: string; amount: string | null }) =>
      api(`${path}/lines/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({ amount }),
      }),
    onSuccess,
  });
  const add = useMutation({
    mutationFn: (studentId: string) =>
      api(`${path}/lines`, {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      }),
    onSuccess: () => {
      setAdding(false);
      onSuccess();
    },
  });
  const remove = useMutation({
    mutationFn: (studentId: string) => api(`${path}/lines/${studentId}`, { method: 'DELETE' }),
    onSuccess,
  });
  const confirm = useMutation({
    mutationFn: () => api(`${path}/confirm`, { method: 'POST' }),
    meta: { successMessage: t('finance.sheets.confirmed') },
    onSuccess,
  });
  const reopen = useMutation({
    mutationFn: () => api(`${path}/reopen`, { method: 'POST' }),
    meta: { successMessage: t('finance.sheets.reopened') },
    onSuccess,
  });

  if (isLoading) {
    return <PageLoader />;
  }
  if (isError || !sheet) {
    return <QueryError onRetry={() => void refetch()} />;
  }

  const editable = sheet.status !== 'confirmed';
  const display = (amount: string | null) =>
    amount === null
      ? ''
      : Number(amount).toLocaleString(toLocale(locale), {
          minimumFractionDigits: 2,
          useGrouping: false,
        });
  const onSheet = new Set(sheet.rows.map((r) => r.studentId));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <span className="text-sm text-muted-foreground">
          {sheet.teachers.length > 0 && t('finance.sheets.teachers', { names: sheet.teachers.join(', ') })}
        </span>
        <SheetStatus
          status={sheet.status}
          className="rounded-sm border border-current px-2 py-0.5 font-heading uppercase"
        />
      </div>

      <ul className="flex flex-col gap-2">
        {sheet.rows.map((r) => (
          <li key={r.studentId} className="flex items-center gap-3 rounded-sm border border-border bg-card px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{r.name}</span>
              <span className="flex flex-wrap gap-x-2.5 text-sm text-muted-foreground">
                <span className="font-mono">{t('finance.sheets.checkins', { count: r.checkins })}</span>
                <span className={r.paid ? 'text-success-text' : 'text-warning-text'}>
                  {t(r.paid ? 'finance.sheets.paid' : 'finance.sheets.pending')}
                </span>
                {r.monthlyFee != null && (
                  <span>
                    {t('finance.sheets.fee', {
                      amount: formatMoney(r.monthlyFee, locale),
                    })}
                  </span>
                )}
              </span>
            </div>
            {editable ? (
              <>
                <label className="flex h-11 w-24 shrink-0 items-center gap-1 rounded-sm border border-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-primary">
                  <span className="text-muted-foreground" aria-hidden>
                    €
                  </span>
                  <input
                    // Remount when the saved value changes, so the cell shows it.
                    key={r.amount ?? ''}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={t('finance.sheets.amountLabel', {
                      name: r.name,
                    })}
                    defaultValue={display(r.amount)}
                    onBlur={(e) => {
                      const amount = parseAmount(e.target.value);
                      if (amount === undefined) {
                        e.target.value = display(r.amount);
                        return;
                      }
                      if (amount !== (r.amount === null ? null : Number(r.amount).toFixed(2))) {
                        save.mutate({ studentId: r.studentId, amount });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full min-w-0 bg-transparent text-right font-mono text-base outline-none"
                  />
                </label>
                {r.addedByHand && (
                  <button
                    type="button"
                    aria-label={t('finance.sheets.remove', { name: r.name })}
                    onClick={() => remove.mutate(r.studentId)}
                    className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </>
            ) : (
              <span className="font-mono">{r.amount === null ? '—' : formatMoney(r.amount, locale)}</span>
            )}
          </li>
        ))}
      </ul>

      {editable &&
        (adding ? (
          <SearchCombobox
            id="payout-add-student"
            aria-label={t('finance.sheets.pickStudent')}
            placeholder={t('finance.sheets.pickStudent')}
            items={students.filter((s) => !onSheet.has(s.id))}
            value={null}
            onChange={(s) => {
              if (s) {
                add.mutate(s.id);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-sm border border-dashed border-border font-semibold text-arena-accent"
          >
            <Plus className="size-4" aria-hidden />
            {t('finance.sheets.addStudent')}
          </button>
        ))}

      <section className="flex flex-col gap-2.5 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            {t('finance.sheets.total')}
          </span>
          <span className="font-mono text-2xl font-bold">{formatMoney(sheet.total ?? 0, locale)}</span>
        </div>
        <p aria-live="polite" className="min-h-5 text-right text-xs text-muted-foreground">
          {save.isPending ? t('finance.sheets.saving') : save.isSuccess ? t('finance.sheets.saved') : ''}
        </p>
        {editable ? (
          <Button className="min-h-11" loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {t('finance.sheets.confirm')}
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('finance.sheets.confirmedHint')}</p>
            <Button variant="outline" className="min-h-11" loading={reopen.isPending} onClick={() => reopen.mutate()}>
              {t('finance.sheets.reopen')}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
