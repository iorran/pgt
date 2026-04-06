import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface OverdueRecord {
  id: string;
  studentName: string;
  belt: string;
  planName: string;
  daysOverdue: number;
}

export default function BillingOverduePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [records, setRecords] = useState<OverdueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.academyId) return;
    api<OverdueRecord[]>(`/payments/overdue?academyId=${user.academyId}`)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  function getBorderColor(days: number) {
    return days >= 8 ? 'border-l-destructive' : 'border-l-yellow-500';
  }

  if (loading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading uppercase tracking-wider text-lg">{t('billing.overdueTitle')}</h1>
        {records.length > 0 && (
          <Badge variant="destructive">{records.length}</Badge>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="text-lg font-heading">{t('billing.noOverdue')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(r => (
            <Card key={r.id} className={`border-l-4 ${getBorderColor(r.daysOverdue)}`}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold">{r.studentName}</p>
                  <Badge variant="outline">{r.belt}</Badge>
                  <p className="text-sm text-muted-foreground">{r.planName}</p>
                </div>
                <div className="text-right">
                  <span className={`arena-stat text-2xl ${r.daysOverdue >= 8 ? 'text-destructive' : 'text-yellow-500'}`}>
                    {r.daysOverdue}
                  </span>
                  <p className="text-xs text-muted-foreground">{t('billing.daysOverdue')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
