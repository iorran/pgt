import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface CheckinRecord {
  id: string;
  classId: string;
  date: string;
  className?: string;
  classType?: string;
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

  if (isLoading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-5 space-y-6">
      <h1 className="font-heading uppercase tracking-wider text-lg">{t('classes.checkinHistory')}</h1>

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
                  <TableCell className="font-mono">{new Date(c.date).toLocaleDateString()}</TableCell>
                  <TableCell>{c.className || c.classId}</TableCell>
                  <TableCell>{c.classType || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
