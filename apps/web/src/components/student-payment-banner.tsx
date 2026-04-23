import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';

/**
 * Thin alert shown at the top of the student shell when their payment is
 * overdue or due soon. Students are redirected from `/` to `/classes`, so
 * the dashboard banner never reaches them — this component covers that gap.
 *
 * Renders nothing when the user isn't a student, the query hasn't resolved,
 * or the status is `ok`.
 */
export function StudentPaymentBanner() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const isStudent = user?.role === 'student';

  const { data: paymentStatus } = useApiQuery<{
    status: string;
    daysOverdue?: number;
    daysUntilDue?: number;
  }>(['my-payment-status'], '/payments/my-status', !!user?.id && isStudent);

  if (!isStudent || !paymentStatus) return null;

  if (paymentStatus.status === 'overdue') {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mx-4 mt-3">
        <p className="text-destructive font-medium text-sm">
          {t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}
        </p>
      </div>
    );
  }

  if (paymentStatus.status === 'upcoming') {
    return (
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mx-4 mt-3">
        <p className="text-primary font-medium text-sm">
          {t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}
        </p>
      </div>
    );
  }

  return null;
}
