import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Plan {
  id: string;
  name: string;
  price: number;
  frequency: string;
  classesPerWeek: number;
}

export default function PlansPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', price: '', frequency: 'monthly', classesPerWeek: '' });

  useEffect(() => {
    if (!user?.academyId) return;
    api<Plan[]>(`/membership-plans?academyId=${user.academyId}`)
      .then(setPlans)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  function startEdit(plan: Plan) {
    setEditId(plan.id);
    setForm({ name: plan.name, price: String(plan.price), frequency: plan.frequency, classesPerWeek: String(plan.classesPerWeek) });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), classesPerWeek: Number(form.classesPerWeek), academyId: user.academyId };
    if (editId) {
      const updated = await api<Plan>(`/membership-plans/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      setPlans(prev => prev.map(p => p.id === editId ? updated : p));
    } else {
      const created = await api<Plan>('/membership-plans', { method: 'POST', body: JSON.stringify(body) });
      setPlans(prev => [...prev, created]);
    }
    setForm({ name: '', price: '', frequency: 'monthly', classesPerWeek: '' });
    setEditId(null);
    setShowForm(false);
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('billing.plansTitle')}</h1>

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', price: '', frequency: 'monthly', classesPerWeek: '' }); }} style={{ padding: '8px 16px' }}>
            {showForm ? t('common.cancel') : t('billing.createPlan')}
          </button>
          {showForm && (
            <form onSubmit={handleSubmit} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('billing.planName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: 8 }} />
              <input type="number" step="0.01" placeholder={t('billing.price')} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required style={{ padding: 8 }} />
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} style={{ padding: 8 }}>
                <option value="monthly">{t('billing.monthly')}</option>
                <option value="quarterly">{t('billing.quarterly')}</option>
                <option value="yearly">{t('billing.yearly')}</option>
              </select>
              <input type="number" placeholder={t('billing.classesPerWeek')} value={form.classesPerWeek} onChange={e => setForm(f => ({ ...f, classesPerWeek: e.target.value }))} required style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 10 }}>{editId ? t('common.save') : t('common.create')}</button>
            </form>
          )}
        </div>
      )}

      {plans.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.planName')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.price')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.frequency')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.classesPerWeek')}</th>
              {user?.role === 'instructor' && (
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('common.edit')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.price}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.frequency}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{p.classesPerWeek}</td>
                {user?.role === 'instructor' && (
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    <button onClick={() => startEdit(p)} style={{ padding: '4px 10px' }}>{t('common.edit')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
