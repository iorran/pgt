import { useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import { TabsNav } from '@/components/tabs-nav';
import { QueryError } from '@/components/query-error';
import { beltKey } from '@/lib/belts';
import { formatList, formatMoney } from '@/lib/format';
import FamilyPaymentDialog from './family-payment-dialog';

function isCritical(days: number) {
  return days >= 8;
}

// The card's left border carries the tier by color; this repeats it in text.
function OverdueDays({ days }: { days: number }) {
  const { t } = useTranslation();
  const critical = isCritical(days);
  return (
    <div className="text-right">
      <span className={`arena-stat text-2xl ${critical ? 'text-danger-text' : 'text-warning-text'}`}>
        {days}
      </span>
      <p className="text-xs text-muted-foreground">{t('billing.daysOverdue', { count: days })}</p>
      <p
        className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${critical ? 'text-danger-text' : 'text-warning-text'}`}
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {t(critical ? 'billing.tierCritical' : 'billing.tierWarning')}
      </p>
    </div>
  );
}

interface StudentOverdue {
  kind: 'student';
  studentId: string;
  studentName: string;
  belt: string;
  phone: string | null;
  daysOverdue: number;
  missedMonths: string[];
  amountDue: string;
}

interface FamilyOverdue {
  kind: 'family';
  familyId: string;
  familyName: string;
  members: { studentId: string; name: string }[];
  phone: string | null;
  daysOverdue: number;
  missedMonths: string[];
  amountDue: string;
}

type OverdueItem = StudentOverdue | FamilyOverdue;

function WhatsAppLink({ phone }: { phone: string }) {
  return (
    <a
      href={`https://wa.me/${phone.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      <MessageCircle />
      WhatsApp
    </a>
  );
}

export default function BillingOverduePage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [payingFamily, setPayingFamily] = useState<FamilyOverdue | null>(null);

  const { data: records = [], isLoading, isError, refetch } = useApiQuery<OverdueItem[]>(
    ['overdue', user?.academyId],
    `/payments/overdue?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const quickPayMutation = useMutation({
    mutationFn: (studentId: string) => api(`/payments/quick/${studentId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    meta: { successMessage: t('billing.paymentRecorded') },
  });

  function getBorderColor(days: number) {
    return isCritical(days) ? 'border-l-destructive' : 'border-l-yellow-500';
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.billing')} items={[
        { to: '/billing', label: t('billing.overdueTitle') },
        { to: '/billing/payments', label: t('billing.paymentsTitle') },
      ]} />
      {records.length > 0 && (
        <Badge variant="destructive">{t('billing.overdueCount', { count: records.length })}</Badge>
      )}

      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="text-lg font-heading">{t('billing.noOverdue')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(r => r.kind === 'family' ? (
            <Card key={r.familyId} className={`border-l-4 ${getBorderColor(r.daysOverdue)}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Badge variant="secondary">{t('billing.family.badge')}</Badge>
                    <p className="font-bold">{r.familyName}</p>
                    <p className="text-sm text-muted-foreground">{formatList(r.members.map(m => m.name), i18n.language)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('billing.missedMonths', { count: r.missedMonths.length })}
                    </p>
                    <p className="arena-stat">{formatMoney(r.amountDue, i18n.language)}</p>
                  </div>
                  <OverdueDays days={r.daysOverdue} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => setPayingFamily(r)}>
                    {t('billing.family.recordPayment')}
                  </Button>
                  {r.phone && <WhatsAppLink phone={r.phone} />}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={r.studentId} className={`border-l-4 ${getBorderColor(r.daysOverdue)}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-bold">{r.studentName}</p>
                    <Badge variant="outline">{t(beltKey(r.belt))}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {t('billing.missedMonths', { count: r.missedMonths?.length ?? 0 })}
                    </p>
                    <p className="arena-stat">{formatMoney(r.amountDue, i18n.language)}</p>
                  </div>
                  <OverdueDays days={r.daysOverdue} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => quickPayMutation.mutate(r.studentId)}
                    loading={quickPayMutation.isPending && quickPayMutation.variables === r.studentId}
                  >
                    {t('billing.recordPayment')}
                  </Button>
                  {r.phone && <WhatsAppLink phone={r.phone} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {payingFamily && (
        <FamilyPaymentDialog
          familyId={payingFamily.familyId}
          familyName={payingFamily.familyName}
          members={payingFamily.members}
          open
          onOpenChange={(open) => {
            if (!open) {
              setPayingFamily(null);
            }
          }}
        />
      )}
    </div>
  );
}
