import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface CompetitionResult {
  id: string;
  competitionName: string;
  date: string;
  position: number;
  status: string;
  studentName?: string;
}

interface Season {
  id: string;
  name: string;
}

export default function ResultsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ competitionName: '', date: '', position: '1' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<Season[]>(`/seasons?academyId=${user.academyId}`)
      .then(data => {
        setSeasons(data);
        if (data.length > 0) setSeasonId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  useEffect(() => {
    if (!seasonId) return;
    if (user?.role === 'instructor') {
      api<CompetitionResult[]>(`/competition-results?seasonId=${seasonId}&status=pending`).then(setResults);
    }
  }, [seasonId, user?.role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/competition-results', {
        method: 'POST',
        body: JSON.stringify({ ...form, position: Number(form.position), studentId: user.id, seasonId }),
      });
      setMsg(t('gamification.resultSubmitted'));
      setForm({ competitionName: '', date: '', position: '1' });
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg(t('gamification.resultError'));
    }
  }

  async function handleApproval(resultId: string, status: 'approved' | 'rejected') {
    await api(`/competition-results/${resultId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setResults(prev => prev.filter(r => r.id !== resultId));
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('gamification.resultsTitle')}</h1>

      {user?.role === 'student' && (
        <div style={{ marginBottom: 24 }}>
          <h2>{t('gamification.submitResult')}</h2>
          {msg && <p style={{ color: 'green', fontWeight: 'bold' }}>{msg}</p>}
          {seasons.length === 0 ? (
            <p>{t('gamification.noSeasons')}</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <select value={seasonId} onChange={e => setSeasonId(e.target.value)} style={{ padding: 8 }}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder={t('gamification.competitionName')} value={form.competitionName} onChange={e => setForm(f => ({ ...f, competitionName: e.target.value }))} required style={{ padding: 8 }} />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={{ padding: 8 }} />
              <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={{ padding: 8 }}>
                <option value="1">{t('gamification.first')}</option>
                <option value="2">{t('gamification.second')}</option>
                <option value="3">{t('gamification.third')}</option>
              </select>
              <button type="submit" style={{ padding: 10 }}>{t('common.save')}</button>
            </form>
          )}
        </div>
      )}

      {user?.role === 'instructor' && (
        <div>
          <h2>{t('gamification.pendingResults')}</h2>
          <div style={{ marginBottom: 12 }}>
            <select value={seasonId} onChange={e => setSeasonId(e.target.value)} style={{ padding: 8 }}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {results.length === 0 ? (
            <p>{t('common.noResults')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.name')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.competitionName')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('classes.date')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.position')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('marketplace.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.studentName || '-'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.competitionName}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.position}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', gap: 4 }}>
                      <button onClick={() => handleApproval(r.id, 'approved')} style={{ padding: '4px 8px', color: 'green' }}>{t('gamification.approve')}</button>
                      <button onClick={() => handleApproval(r.id, 'rejected')} style={{ padding: '4px 8px', color: 'red' }}>{t('gamification.reject')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
