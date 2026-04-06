import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Payment {
  id: string;
  studentName?: string;
  amount: number;
  paymentDate: string;
  referenceMonth: string;
}

interface Student {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentId: '', amount: '', paymentDate: '', referenceMonth: '' });

  useEffect(() => {
    if (!user?.academyId) return;
    Promise.all([
      api<Payment[]>(`/payments?academyId=${user.academyId}`),
      api<Student[]>(`/students?academyId=${user.academyId}`),
    ])
      .then(([p, s]) => { setPayments(p); setStudents(s); })
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify({ ...form, amount: Number(form.amount), academyId: user.academyId }),
    });
    setPayments(prev => [created, ...prev]);
    setForm({ studentId: '', amount: '', paymentDate: '', referenceMonth: '' });
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('billing.paymentsTitle')}</h1>

      <div style={{ marginBottom: 24 }}>
        <h2>{t('billing.recordPayment')}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
          <select value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} required style={{ padding: 8 }}>
            <option value="">{t('billing.selectStudent')}</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" step="0.01" placeholder={t('billing.amount')} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required style={{ padding: 8 }} />
          <input type="date" placeholder={t('billing.date')} value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} required style={{ padding: 8 }} />
          <input type="month" placeholder={t('billing.referenceMonth')} value={form.referenceMonth} onChange={e => setForm(f => ({ ...f, referenceMonth: e.target.value }))} required style={{ padding: 8 }} />
          <button type="submit" style={{ padding: 10 }}>{t('common.save')}</button>
        </form>
      </div>

      <h2>{t('billing.recentPayments')}</h2>
      {payments.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.name')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.amount')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.date')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.referenceMonth')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.studentName || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.amount}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.referenceMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
