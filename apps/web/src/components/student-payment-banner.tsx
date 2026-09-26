import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { isStudent } from '@/lib/roles';
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
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const isStudentUser = isStudent(user ?? null);

  const { data: paymentStatus } = useApiQuery<{
    status: string;
    daysOverdue?: number;
    daysUntilDue?: number;
  }>(['my-payment-status'], '/payments/my-status', !!user?.id && isStudentUser);

  // The billing page already shows the full status.
  if (!isStudentUser || !paymentStatus || pathname === '/me/billing') return null;

  if (paymentStatus.status === 'overdue') {
    return (
      <div role="alert" className="mx-4 mt-3">
        <Link
          to="/me/billing"
          className="flex min-h-11 items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>
    );
  }

  if (paymentStatus.status === 'upcoming') {
    return (
      <div className="mx-4 mt-3">
        <Link
          to="/me/billing"
          className="flex min-h-11 items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary"
        >
          <span className="flex-1">{t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>
    );
  }

  return null;
}
