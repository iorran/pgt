import { useTranslation } from 'react-i18next';
import { AlertTriangle, Medal } from 'lucide-react';
import { formatDate, formatMoney } from '@/lib/format';
import type { MySeminar } from '@/pages/classes/student-view';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { SubpageHeader } from '@/components/subpage-header';

type PaymentStatus = {
  status: 'ok' | 'overdue' | 'upcoming';
  daysOverdue?: number;
  daysUntilDue?: number;
};

export default function BillingStatusPage() {
  const { t, i18n } = useTranslation();
  const { data: seminars = [] } = useApiQuery<MySeminar[]>(['my-seminars'], '/seminars/mine');
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
                  ? 'font-display text-3xl text-danger-text'
                  : 'font-display text-3xl text-success-text'
              }
            >
              {data.status === 'overdue' ? t('me.billingOverdue') : t('me.billingUpToDate')}
            </span>
            {data.status === 'overdue' ? (
              <span className="text-sm text-muted-foreground">
                {t('billing.yourPaymentOverdue', { count: data.daysOverdue })}
              </span>
            ) : null}
            {data.status === 'upcoming' ? (
              <span className="text-sm text-muted-foreground">
                {t('billing.paymentDueSoon', { count: data.daysUntilDue })}
              </span>
            ) : null}
          </CardContent>
        </Card>
      )}
      {seminars.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 pt-2 font-heading text-lg uppercase text-seminar">
            <Medal className="size-4" aria-hidden />
            {t('seminars.sectionTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('seminars.sectionHint')}</p>
          <ul className="space-y-2">
            {seminars.map((s) => (
              <li
                key={s.classId}
                className={`flex items-center justify-between gap-3 rounded-sm border bg-card p-3.5 ${s.paidAt ? 'border-border' : 'border-seminar'}`}
              >
                <span className="min-w-0">
                  <span className="block font-heading uppercase">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDate(s.date, i18n.language)}
                    {(s.guestTeacherName || s.teacher) && ` · ${s.guestTeacherName ?? s.teacher?.name}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block font-mono ${s.paidAt ? '' : 'text-seminar'}`}>{formatMoney(s.amount, i18n.language)}</span>
                  <span className={`block text-xs ${s.paidAt ? 'text-success-text' : 'text-seminar'}`}>
                    {s.paidAt ? t('seminars.paidOn', { date: formatDate(s.paidAt, i18n.language) }) : t('seminars.pending')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
