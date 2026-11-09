import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';
import { buttonVariants } from '@/components/ui/button';
import { QueryError } from '@/components/query-error';
import { isOwner } from '@/lib/roles';
import { EmptyState } from '@/components/empty-state';

interface CheckinRecord {
  id: string;
  checkedInAt: string;
  date: string; // YYYY-MM-DD, TZ-formatted by API
  class: { id: string; name: string; type: string } | null;
  student?: { id: string; name: string };
}

export default function CheckinHistoryPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  // The owner doesn't train here: their history is every student's check-ins.
  const owner = isOwner(user);

  const { data: checkins = [], isLoading, isError, refetch } = useApiQuery<CheckinRecord[]>(
    owner ? ['checkins', 'academy'] : ['checkins', user?.id],
    owner ? '/checkins/academy' : `/checkins/student/${user?.id}`,
    !!user?.id,
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.classes')} items={[
        { to: '/classes', label: t('classes.title') },
        { to: '/classes/history', label: t('classes.checkinHistory') },
      ]} />

      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : checkins.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t(owner ? 'classes.noAcademyCheckins' : 'classes.noCheckins')}
          description={t(owner ? 'emptyState.checkins.ownerDescription' : 'emptyState.checkins.description')}
          action={
            !owner && (
              <Link to="/classes" className={buttonVariants({ variant: 'outline' })}>
                {t('classes.viewSchedule')}
              </Link>
            )
          }
          help="Histórico de Presença"
          studentHelp="Ver Seu Histórico de Check-ins"
        />
      ) : (
        <div className="rounded-sm border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('classes.date')}</TableHead>
                {owner && <TableHead>{t('classes.student')}</TableHead>}
                <TableHead>{t('classes.className')}</TableHead>
                <TableHead>{t('classes.classType')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkins.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.date}</TableCell>
                  {owner && (
                    <TableCell>
                      {c.student && (
                        <Link to={`/students/${c.student.id}`} className="text-primary hover:underline">
                          {c.student.name}
                        </Link>
                      )}
                    </TableCell>
                  )}
                  <TableCell>{c.class?.name ?? '—'}</TableCell>
                  <TableCell>{c.class?.type ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
