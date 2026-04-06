import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Student {
  id: string;
  name: string;
  email: string;
  belt: string;
  phone?: string;
  plan?: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  referenceMonth: string;
  status?: string;
}

export default function StudentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMembership, setShowMembership] = useState(false);
  const [memberForm, setMemberForm] = useState({ planId: '', startDate: '', dueDay: '' });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<Student>(`/students/${id}`),
      api<Payment[]>(`/payments/student/${id}`),
    ])
      .then(([s, p]) => { setStudent(s); setPayments(p); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAssignMembership(e: React.FormEvent) {
    e.preventDefault();
    await api(`/students/${id}/membership`, {
      method: 'POST',
      body: JSON.stringify({ ...memberForm, dueDay: Number(memberForm.dueDay) }),
    });
    setShowMembership(false);
    // refresh
    const s = await api<Student>(`/students/${id}`);
    setStudent(s);
  }

  if (loading) return <div>{t('common.loading')}</div>;
  if (!student) return <div>{t('common.noResults')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate('/students')} style={{ marginBottom: 16, padding: '6px 12px' }}>{t('common.back')}</button>
      <h1>{student.name}</h1>
      <div style={{ marginBottom: 20 }}>
        <p><strong>{t('students.email')}:</strong> {student.email}</p>
        <p><strong>{t('students.belt')}:</strong> {student.belt}</p>
        {student.phone && <p><strong>{t('students.phone')}:</strong> {student.phone}</p>}
        <p><strong>{t('students.plan')}:</strong> {student.plan || '-'}</p>
      </div>

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowMembership(!showMembership)} style={{ padding: '8px 16px' }}>
            {showMembership ? t('common.cancel') : t('students.assignMembership')}
          </button>
          {showMembership && (
            <form onSubmit={handleAssignMembership} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('students.planId')} value={memberForm.planId} onChange={e => setMemberForm(f => ({ ...f, planId: e.target.value }))} required style={{ padding: 8 }} />
              <input type="date" placeholder={t('students.startDate')} value={memberForm.startDate} onChange={e => setMemberForm(f => ({ ...f, startDate: e.target.value }))} required style={{ padding: 8 }} />
              <input type="number" placeholder={t('students.dueDay')} value={memberForm.dueDay} onChange={e => setMemberForm(f => ({ ...f, dueDay: e.target.value }))} required min={1} max={31} style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 10 }}>{t('common.save')}</button>
            </form>
          )}
        </div>
      )}

      <h2>{t('students.paymentHistory')}</h2>
      {payments.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.date')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.amount')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.referenceMonth')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.amount}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.referenceMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
