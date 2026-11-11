import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabsNav } from '@/components/tabs-nav';
import { formatMonth, shiftMonth, todayYmd } from '@/lib/format';

export const currentMonth = () => todayYmd().slice(0, 7);

// Financeiro: Cobranças (overdue + payments) | Balanço | Despesas | Repasses.
export function FinanceTabs() {
  const { t } = useTranslation();
  return (
    <TabsNav
      title={t('nav.billing')}
      items={[
        { to: '/billing', label: t('finance.tabs.charges'), also: ['/billing/payments'] },
        { to: '/billing/balance', label: t('finance.tabs.balance') },
        { to: '/billing/expenses', label: t('finance.tabs.expenses') },
        { to: '/billing/payouts', label: t('finance.tabs.payouts') },
      ]}
    />
  );
}

export function MonthSwitcher({
  month,
  onChange,
  children,
}: {
  month: string;
  onChange: (month: string) => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const button =
    'inline-flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted';
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" aria-label={t('finance.prevMonth')} className={button} onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <div className="text-center">
        <p aria-live="polite" className="font-heading text-xl uppercase">
          {formatMonth(month, i18n.language)}
        </p>
        {children}
      </div>
      <button type="button" aria-label={t('finance.nextMonth')} className={button} onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
