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
    <div className="p-5 space-y-6">
      <TabsNav items={[
        { to: '/classes', label: t('classes.title') },
        { to: '/classes/history', label: t('classes.checkinHistory') },
      ]} />

      {checkins.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
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
