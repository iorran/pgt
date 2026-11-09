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

// Newest first, as the API returns: day → class → students.
function groupByDayAndClass(rows: CheckinRecord[]) {
  const days = new Map<string, Map<string, CheckinRecord[]>>();
  for (const r of rows) {
    const classes = days.get(r.date) ?? new Map<string, CheckinRecord[]>();
    days.set(r.date, classes);
    const key = r.class?.id ?? '—';
    classes.set(key, [...(classes.get(key) ?? []), r]);
  }
  return [...days].map(([date, classes]) => ({ date, classes: [...classes.values()] }));
}

function OwnerHistory({ checkins }: { checkins: CheckinRecord[] }) {
  const { t, i18n } = useTranslation();
  const dayFormat = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: '2-digit', month: '2-digit' });
  return (
    <div className="space-y-6">
      {groupByDayAndClass(checkins).map(({ date, classes }) => (
        <section key={date} className="space-y-2">
          <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            {dayFormat.format(new Date(`${date}T12:00:00`))}
          </h2>
          {classes.map((rows) => {
            const cls = rows[0].class;
            const titleId = `h-${date}-${cls?.id ?? 'none'}`;
            return (
              <article key={titleId} aria-labelledby={titleId} className="rounded-sm border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 id={titleId} className="font-heading text-lg uppercase leading-tight">{cls?.name ?? '—'}</h3>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {t('classes.studentCount', { count: rows.length })}
                  </span>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1">
                  {rows.map((r) => (
                    <li key={r.id}>
                      {r.student && (
                        <Link
                          to={`/students/${r.student.id}`}
                          className="inline-flex min-h-9 items-center rounded-sm bg-muted px-2 text-sm text-foreground hover:text-primary"
                        >
                          {r.student.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
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
      ) : owner ? (
        <OwnerHistory checkins={checkins} />
      ) : (
        <div className="rounded-sm border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('classes.date')}</TableHead>
                <TableHead>{t('classes.className')}</TableHead>
                <TableHead>{t('classes.classType')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkins.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.date}</TableCell>
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
