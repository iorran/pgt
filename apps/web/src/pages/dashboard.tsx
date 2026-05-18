import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({
  value,
  label,
  isLoading,
}: {
  value: number;
  label: string;
  isLoading: boolean;
}) {
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
  const isOwnerUser = isOwner(user);

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

  const { data: tournaments = [], isLoading: tournamentsLoading } = useApiQuery<
    any[]
  >(
    ['tournaments', user?.academyId],
    `/tournaments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: paymentStatus } = useApiQuery<{
    status: string;
    daysOverdue?: number;
    daysUntilDue?: number;
  }>(['my-payment-status'], '/payments/my-status', !!user?.id && !isOwnerUser);

  function handleOpenTotem() {
    window.open('/totem', '_blank', 'noopener');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.dashboard')}
      </h1>

      <p className="text-muted-foreground">
        {t('dashboard.greeting', { name: user?.name })}
      </p>

      {!isOwnerUser && paymentStatus?.status === 'overdue' && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive font-medium text-sm">
            {t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}
          </p>
        </div>
      )}

      {!isOwnerUser && paymentStatus?.status === 'upcoming' && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-primary font-medium text-sm">
            {t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}
          </p>
        </div>
      )}

      {isOwnerUser && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {t('totem.openTotem')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('totem.openTotemExplainer')}
            </p>
            <Button variant="outline" onClick={handleOpenTotem}>
              {t('totem.openTotem')}
            </Button>
          </CardContent>
        </Card>
      )}

      {isOwnerUser && (
        <Link to="/owner/dashboard" className="block">
          <Card className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="font-heading text-xl uppercase">
                Academy dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Aderência, classes, students.
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          value={students.length}
          label={t('nav.students')}
          isLoading={studentsLoading}
        />
        <StatCard
          value={classes.length}
          label={t('nav.classes')}
          isLoading={classesLoading}
        />
        <StatCard
          value={tournaments.length}
          label={t('nav.tournaments')}
          isLoading={tournamentsLoading}
        />
      </div>
    </div>
  );
}
