import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  federation?: string;
}

interface RosterEntry {
  id: string;
  studentName: string;
  belt: string;
  weightClass: string;
}

export default function TournamentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', date: '', location: '', federation: '' });
  const [signupTournamentId, setSignupTournamentId] = useState<string | null>(null);
  const [weightClass, setWeightClass] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterTournamentId, setRosterTournamentId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<Tournament[]>(`/tournaments?academyId=${user.academyId}`)
      .then(setTournaments)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<Tournament>('/tournaments', {
      method: 'POST',
      body: JSON.stringify({ ...createForm, academyId: user.academyId }),
    });
    setTournaments(prev => [...prev, created]);
    setCreateForm({ name: '', date: '', location: '', federation: '' });
    setShowCreate(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupTournamentId) return;
    try {
      await api(`/tournaments/${signupTournamentId}/signup`, {
        method: 'POST',
        body: JSON.stringify({ studentId: user.id, weightClass }),
      });
      setMsg(t('tournaments.signupSuccess'));
      setSignupTournamentId(null);
      setWeightClass('');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg(t('tournaments.signupError'));
    }
  }

  async function viewRoster(tournamentId: string) {
    if (rosterTournamentId === tournamentId) {
      setRosterTournamentId(null);
      setRoster([]);
      return;
    }
    const data = await api<RosterEntry[]>(`/tournaments/${tournamentId}/roster`);
    setRoster(data);
    setRosterTournamentId(tournamentId);
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('tournaments.title')}</h1>

      {msg && <p style={{ color: 'green', fontWeight: 'bold' }}>{msg}</p>}

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '8px 16px' }}>
            {showCreate ? t('common.cancel') : t('tournaments.createTournament')}
          </button>
          {showCreate && (
            <form onSubmit={handleCreate} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('tournaments.tournamentName')} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: 8 }} />
              <input type="date" value={createForm.date} onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))} required style={{ padding: 8 }} />
              <input placeholder={t('tournaments.location')} value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} required style={{ padding: 8 }} />
              <input placeholder={t('tournaments.federation')} value={createForm.federation} onChange={e => setCreateForm(f => ({ ...f, federation: e.target.value }))} style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 10 }}>{t('common.create')}</button>
            </form>
          )}
        </div>
      )}

      {tournaments.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <div>
          {tournaments.map(tr => (
            <div key={tr.id} style={{ padding: 14, border: '1px solid #ddd', borderRadius: 6, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{tr.name}</strong>
                  <br />
                  <span style={{ color: '#666' }}>{new Date(tr.date).toLocaleDateString()} - {tr.location}</span>
                  {tr.federation && <span style={{ marginLeft: 8, color: '#888' }}>{tr.federation}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {user?.role === 'student' && (
                    <button onClick={() => setSignupTournamentId(signupTournamentId === tr.id ? null : tr.id)} style={{ padding: '6px 14px' }}>
                      {t('tournaments.signUp')}
                    </button>
                  )}
                  {user?.role === 'instructor' && (
                    <button onClick={() => viewRoster(tr.id)} style={{ padding: '6px 14px' }}>
                      {t('tournaments.viewRoster')}
                    </button>
                  )}
                </div>
              </div>

              {signupTournamentId === tr.id && (
                <form onSubmit={handleSignup} style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input placeholder={t('tournaments.weightClass')} value={weightClass} onChange={e => setWeightClass(e.target.value)} required style={{ padding: 8 }} />
                  <button type="submit" style={{ padding: '8px 16px' }}>{t('common.confirm')}</button>
                </form>
              )}

              {rosterTournamentId === tr.id && (
                <div style={{ marginTop: 10 }}>
                  <h3>{t('tournaments.roster')}</h3>
                  {roster.length === 0 ? (
                    <p>{t('common.noResults')}</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{t('students.name')}</th>
                          <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{t('students.belt')}</th>
                          <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{t('tournaments.weightClass')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map(r => (
                          <tr key={r.id}>
                            <td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{r.studentName}</td>
                            <td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{r.belt}</td>
                            <td style={{ padding: 6, borderBottom: '1px solid #eee' }}>{r.weightClass}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
