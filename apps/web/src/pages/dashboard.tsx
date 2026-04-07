import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  joinCode: string;
}

function StatCard({ value, label, isLoading }: { value: number; label: string; isLoading: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : (
          <p className="font-mono text-3xl text-primary arena-stat">{value}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isInstructor = user?.role === 'instructor';
  const [copied, setCopied] = useState(false);

  const { data: academy } = useApiQuery<AcademyInfo>(
    ['academy-mine'],
    '/academies/mine',
    !!user?.academyId,
  );

  const { data: students = [], isLoading: studentsLoading } = useApiQuery<any[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: classes = [], isLoading: classesLoading } = useApiQuery<any[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: tournaments = [], isLoading: tournamentsLoading } = useApiQuery<any[]>(
    ['tournaments', user?.academyId],
    `/tournaments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: paymentStatus } = useApiQuery<{ status: string; daysOverdue?: number; daysUntilDue?: number }>(
    ['my-payment-status'],
    '/payments/my-status',
    !!user?.id && !isInstructor,
  );

  function handleCopy() {
    if (!academy) return;
    navigator.clipboard.writeText(academy.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareWhatsApp() {
    if (!academy) return;
    const message = `${t('onboarding.shareMessage')} ${window.location.origin}/entrar/${academy.joinCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.dashboard')}
      </h1>

      <p className="text-muted-foreground">
        {t('common.loading').replace('...', '')}, {user?.name}
      </p>

      {!isInstructor && paymentStatus?.status === 'overdue' && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive font-medium text-sm">
            {t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}
          </p>
        </div>
      )}

      {!isInstructor && paymentStatus?.status === 'upcoming' && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-primary font-medium text-sm">
            {t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}
          </p>
        </div>
      )}

      {isInstructor && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {academy.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('onboarding.joinCode')}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl bg-secondary p-4 rounded-sm flex-1 text-center">
                  {academy.joinCode}
                </span>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? t('onboarding.copied') : t('onboarding.copyCode')}
                </Button>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleShareWhatsApp}>
              {t('onboarding.shareWhatsApp')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard value={students.length} label={t('nav.students')} isLoading={studentsLoading} />
        <StatCard value={classes.length} label={t('nav.classes')} isLoading={classesLoading} />
        <StatCard value={tournaments.length} label={t('nav.tournaments')} isLoading={tournamentsLoading} />
      </div>
    </div>
  );
}
