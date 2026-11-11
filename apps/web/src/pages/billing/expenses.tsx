import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { QueryError } from '@/components/query-error';
import { formatMoney, formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FinanceTabs, MonthSwitcher, currentMonth } from './finance-nav';

interface Expense {
  id: string;
  description: string;
  amount: string;
  oneOff: boolean;
  confirmed: boolean;
}

const ROW = 'grid grid-cols-[minmax(0,1fr)_7.5rem_2.75rem] items-center';
const CELL_INPUT = 'h-11 w-full min-w-0 bg-transparent px-3 text-right font-mono text-base outline-none focus:bg-primary/10 focus:ring-2 focus:ring-inset focus:ring-primary';

export default function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [oneOff, setOneOff] = useState(false);
  const { data, isLoading, isError, refetch } = useApiQuery<{ month: string; expenses: Expense[] }>(
    ['finance-expenses', month],
    `/finance/expenses?month=${month}`,
  );

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-expenses', month] });
    queryClient.invalidateQueries({ queryKey: ['finance-balance'] });
  };
  const save = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api(`/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify({ amount: value }) }),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/finance/expenses/${id}`, { method: 'DELETE' }),
    onSuccess,
  });
  const add = useMutation({
    mutationFn: () =>
      api('/finance/expenses', { method: 'POST', body: JSON.stringify({ month, description: description.trim(), amount, oneOff }) }),
    onSuccess: () => {
      setDescription('');
      setAmount('');
      setOneOff(false);
      onSuccess();
    },
  });

  if (isLoading) {
    return <PageLoader />;
  }
  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <FinanceTabs />
      <MonthSwitcher month={month} onChange={setMonth} />
      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <>
          {expenses.some((e) => !e.confirmed) && (
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">{t('finance.expenses.copied')}</p>
          )}
          <section aria-label={t('finance.expenses.listLabel', { month: formatMonth(month, i18n.language) })} className="overflow-hidden rounded-lg bg-card">
            <div className={cn(ROW, 'border-b border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground')}>
              <span>{t('finance.expenses.description')}</span>
              <span className="text-right">{t('finance.expenses.amount')}</span>
              <span />
            </div>
            {expenses.map((e) => (
              <div key={e.id} className={cn(ROW, 'border-b border-border/60')}>
                <label htmlFor={`expense-${e.id}`} className="truncate px-3 py-3">
                  {e.description}
                  {e.oneOff && (
                    <span className="text-xs text-muted-foreground">
                      {' · '}
                      <span>{t('finance.expenses.oneOffTag')}</span>
                    </span>
                  )}
                </label>
                <input
                  // Remount when the saved value changes, so the cell shows it.
                  key={`${e.amount}-${e.confirmed}`}
                  id={`expense-${e.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  defaultValue={Number(e.amount)}
                  onBlur={(ev) => {
                    const value = ev.target.value;
                    if (value !== '' && (Number(value) !== Number(e.amount) || !e.confirmed)) {
                      save.mutate({ id: e.id, value });
                    }
                  }}
                  className={cn(CELL_INPUT, 'border-l border-border/60', !e.confirmed && 'text-muted-foreground')}
                />
                <button
                  type="button"
                  aria-label={t('finance.expenses.remove', { name: e.description })}
                  onClick={() => remove.mutate(e.id)}
                  className="flex h-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            <form
              className="flex flex-col gap-2 border-b border-border/60 p-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                add.mutate();
              }}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t('finance.expenses.newDescription')}
                  <input
                    value={description}
                    onChange={(ev) => setDescription(ev.target.value)}
                    required
                    maxLength={255}
                    className="h-11 rounded-sm border border-border bg-background px-3 text-base text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t('finance.expenses.newAmount')}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(ev) => setAmount(ev.target.value)}
                    required
                    className="h-11 rounded-sm border border-border bg-background px-3 text-right font-mono text-base text-foreground"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={oneOff} onChange={(ev) => setOneOff(ev.target.checked)} className="size-5 accent-primary" />
                  {t('finance.expenses.oneOff')}
                </label>
                <button
                  type="submit"
                  disabled={add.isPending}
                  className="inline-flex min-h-11 items-center gap-1.5 px-2 font-bold text-primary disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden />
                  {t('finance.expenses.addRow')}
                </button>
              </div>
            </form>
            <div className={cn(ROW, 'bg-muted py-3')}>
              <span className="px-3 text-sm font-bold uppercase">{t('finance.expenses.total')}</span>
              <span className="px-3 text-right font-mono font-bold">{formatMoney(total, i18n.language)}</span>
              <span />
            </div>
          </section>
          <p className="text-sm text-muted-foreground">{t('finance.expenses.hint')}</p>
        </>
      )}
    </div>
  );
}
