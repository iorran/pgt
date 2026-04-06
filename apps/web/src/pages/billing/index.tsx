import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

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

  function getColor(days: number) {
    if (days >= 8) return '#fee2e2';
    if (days >= 1) return '#fef9c3';
    return 'transparent';
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('billing.overdueTitle')}</h1>
      {records.length === 0 ? (
        <p>{t('billing.noOverdue')}</p>
      ) : (
        <div>
          {records.map(r => (
            <div
              key={r.id}
              style={{
                padding: 14,
                border: '1px solid #ddd',
                borderRadius: 6,
                marginBottom: 8,
                backgroundColor: getColor(r.daysOverdue),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{r.studentName}</strong> <span style={{ color: '#666' }}>({r.belt})</span>
                <br />
                <span>{r.planName}</span>
              </div>
              <div style={{ fontWeight: 'bold', color: r.daysOverdue >= 8 ? '#dc2626' : '#ca8a04' }}>
                {r.daysOverdue} {t('billing.daysOverdue')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
