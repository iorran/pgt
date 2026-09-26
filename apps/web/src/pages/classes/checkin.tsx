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

interface CheckinRecord {
  id: string;
  checkedInAt: string;
  date: string; // YYYY-MM-DD, TZ-formatted by API
  class: { id: string; name: string; type: string } | null;
}

export default function CheckinHistoryPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;

  const { data: checkins = [], isLoading } = useApiQuery<CheckinRecord[]>(
    ['checkins', user?.id],
    `/checkins/student/${user?.id}`,
    !!user?.id,
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.classes')} items={[
        { to: '/classes', label: t('classes.title') },
        { to: '/classes/history', label: t('classes.checkinHistory') },
      ]} />

      {checkins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <CalendarCheck className="size-12" />
          <p className="text-lg font-heading">{t('classes.noCheckins')}</p>
          <Link to="/classes" className={buttonVariants({ variant: 'outline' })}>
            {t('classes.viewSchedule')}
          </Link>
        </div>
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
