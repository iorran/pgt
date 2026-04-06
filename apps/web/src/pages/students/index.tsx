import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  belt: string;
  plan?: string;
  dueDay?: number;
}

export default function StudentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.academyId) return;
    api<Student[]>(`/students?academyId=${user.academyId}`)
      .then(setStudents)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('students.title')}</h1>
      {students.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.name')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.belt')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.plan')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.dueDay')}</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <Link to={`/students/${s.id}`}>{s.name}</Link>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.belt}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.plan || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.dueDay ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
