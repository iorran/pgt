import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

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
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api<CheckinRecord[]>(`/checkins/student/${user.id}`)
      .then(setCheckins)
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('classes.checkinHistory')}</h1>
      {checkins.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('classes.date')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('classes.className')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('classes.classType')}</th>
            </tr>
          </thead>
          <tbody>
            {checkins.map(c => (
              <tr key={c.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(c.date).toLocaleDateString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.className || c.classId}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{c.classType || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
