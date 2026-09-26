import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { SubpageHeader } from './subpage-header';

type PaymentStatus = {
  status: 'ok' | 'overdue' | 'upcoming';
  daysOverdue?: number;
  daysUntilDue?: number;
};

export default function BillingStatusPage() {
  const { t } = useTranslation();
  // Same query key as the student payment banner, so both share one request.
  const { data, isLoading, isError } = useApiQuery<PaymentStatus>(['my-payment-status'], '/payments/my-status');

  return (
    <div className="flex flex-col gap-4">
      <SubpageHeader title={t('me.billingStatus')} />
      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : isError || !data ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {t('me.billingError')}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <span
              className={
                data.status === 'overdue'
                  ? 'font-display text-3xl text-[color:var(--pgt-red)]'
                  : 'font-display text-3xl text-[color:var(--pgt-green)]'
              }
            >
              {data.status === 'overdue' ? t('me.billingOverdue') : t('me.billingUpToDate')}
            </span>
            {data.status === 'overdue' ? (
              <span className="text-sm text-muted-foreground">
                {t('billing.yourPaymentOverdue', { days: data.daysOverdue })}
              </span>
            ) : null}
            {data.status === 'upcoming' ? (
              <span className="text-sm text-muted-foreground">
                {t('billing.paymentDueSoon', { days: data.daysUntilDue })}
              </span>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
