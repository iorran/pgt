import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';

export default function BillingStatusPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'billing-status'],
    queryFn: async () => {
      const res = await fetch('/api/me/billing-status', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{ status: 'up_to_date' | 'overdue'; amount?: number }>;
    },
  });

  if (isLoading) return <div>{t('common.loading')}</div>;

  const isOverdue = data?.status === 'overdue';

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="font-heading text-sm uppercase text-muted-foreground">
          {t('me.billingStatus')}
        </span>
        <span
          className={
            isOverdue
              ? 'font-display text-3xl text-[color:var(--pgt-red)]'
              : 'font-display text-3xl text-[color:var(--pgt-green)]'
          }
        >
          {isOverdue
            ? t('me.billingOverdue')
            : t('me.billingUpToDate')}
        </span>
        {isOverdue && data?.amount ? (
          <span className="font-mono text-lg">R$ {(data.amount / 100).toFixed(2)}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
