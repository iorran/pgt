import { useSession } from '@/lib/auth-client';
import { useSearchParams } from 'react-router-dom';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card } from '@/components/ui/card';
import { PeriodToggle } from './components/period-toggle';
import { AderenciaChart } from './components/aderencia-chart';
import { ClassesList } from './components/classes-list';
import { StudentsList } from './components/students-list';

type Period = 'day' | 'week' | 'month';

interface AderenciaResponse {
  period: Period;
  from: string;
  to: string;
  classes: Array<{
    classId: string;
    name: string;
    type: string;
    totalCheckins: number;
    uniqueStudents: number;
    occurrences: number;
    avgPerOccurrence: number;
    trend: number | null;
  }>;
}

interface StudentsResponse {
  students: Array<{
    id: string;
    name: string;
    belt: string;
    lastCheckinAt: string | null;
    daysSinceCheckin: number | null;
    status: 'active' | 'slowing' | 'drifting' | 'inactive';
  }>;
}

export default function OwnerDashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const [params, setParams] = useSearchParams();
  const period = (params.get('period') as Period) || 'week';

  // Role gate (must appear before hooks dependent on being owner, but react-hook rules
  // require hooks to run unconditionally — so do the queries then render conditionally)
  const isOwner = user?.role === 'owner';

  const { data: aderencia, isLoading: loadingA } = useApiQuery<AderenciaResponse>(
    ['owner', 'aderencia', period],
    `/owner/classes/aderencia?period=${period}`,
    isOwner,
  );
  const { data: students, isLoading: loadingS } = useApiQuery<StudentsResponse>(
    ['owner', 'students'],
    '/owner/students',
    isOwner,
  );

  if (!user) return <PageLoader />;
  if (!isOwner) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl">Forbidden (403)</h1>
        <p className="text-muted-foreground">Owner access required.</p>
      </div>
    );
  }
  if (loadingA || loadingS) return <PageLoader />;

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Academy dashboard</h1>
        <PeriodToggle value={period} onChange={(p) => setParams({ period: p })} />
      </div>
      <Card className="p-4">
        <AderenciaChart data={aderencia?.classes ?? []} />
      </Card>
      <Card className="p-4">
        <ClassesList
          classes={aderencia?.classes ?? []}
          period={period}
          from={aderencia?.from ?? ''}
          to={aderencia?.to ?? ''}
        />
      </Card>
      <Card className="p-4">
        <StudentsList students={students?.students ?? []} />
      </Card>
    </div>
  );
}
