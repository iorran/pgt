import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  prize?: string;
  pointsConfig?: { first: number; second: number; third: number };
}

export default function SeasonsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', prize: '', firstPoints: '10', secondPoints: '7', thirdPoints: '5' });

  useEffect(() => {
    if (!user?.academyId) return;
    api<Season[]>(`/seasons?academyId=${user.academyId}`)
      .then(setSeasons)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      prize: form.prize,
      pointsConfig: { first: Number(form.firstPoints), second: Number(form.secondPoints), third: Number(form.thirdPoints) },
      academyId: user.academyId,
    };
    const created = await api<Season>('/seasons', { method: 'POST', body: JSON.stringify(body) });
    setSeasons(prev => [...prev, created]);
    setForm({ name: '', startDate: '', endDate: '', prize: '', firstPoints: '10', secondPoints: '7', thirdPoints: '5' });
    setShowForm(false);
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('gamification.seasonsTitle')}</h1>

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px' }}>
            {showForm ? t('common.cancel') : t('gamification.createSeason')}
          </button>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('gamification.seasonName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: 8 }} />
              <label style={{ fontSize: 13 }}>{t('gamification.startDate')}</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required style={{ padding: 8 }} />
              <label style={{ fontSize: 13 }}>{t('gamification.endDate')}</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required style={{ padding: 8 }} />
              <input placeholder={t('gamification.prize')} value={form.prize} onChange={e => setForm(f => ({ ...f, prize: e.target.value }))} style={{ padding: 8 }} />
              <label style={{ fontSize: 13 }}>{t('gamification.pointsConfig')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" placeholder={t('gamification.first')} value={form.firstPoints} onChange={e => setForm(f => ({ ...f, firstPoints: e.target.value }))} style={{ padding: 8, flex: 1 }} />
                <input type="number" placeholder={t('gamification.second')} value={form.secondPoints} onChange={e => setForm(f => ({ ...f, secondPoints: e.target.value }))} style={{ padding: 8, flex: 1 }} />
                <input type="number" placeholder={t('gamification.third')} value={form.thirdPoints} onChange={e => setForm(f => ({ ...f, thirdPoints: e.target.value }))} style={{ padding: 8, flex: 1 }} />
              </div>
              <button type="submit" style={{ padding: 10 }}>{t('common.create')}</button>
            </form>
          )}
        </div>
      )}

      {seasons.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.seasonName')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.startDate')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.endDate')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.prize')}</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(s.startDate).toLocaleDateString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(s.endDate).toLocaleDateString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{s.prize || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
