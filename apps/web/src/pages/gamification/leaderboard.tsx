import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Season {
  id: string;
  name: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  belt: string;
  totalPoints: number;
}

const BELTS = ['white', 'blue', 'purple', 'brown', 'black'];

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [category, setCategory] = useState<'adults' | 'kids'>('adults');
  const [belt, setBelt] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
    let url = `/seasons/${seasonId}/leaderboard?category=${category}`;
    if (category === 'adults' && belt) url += `&belt=${belt}`;
    api<LeaderboardEntry[]>(url).then(setEntries);
  }, [seasonId, category, belt]);

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('gamification.leaderboardTitle')}</h1>

      {seasons.length === 0 ? (
        <p>{t('gamification.noSeasons')}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={seasonId} onChange={e => setSeasonId(e.target.value)} style={{ padding: 8 }}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => { setCategory('adults'); setBelt(''); }}
                style={{ padding: '6px 14px', fontWeight: category === 'adults' ? 'bold' : 'normal', borderBottom: category === 'adults' ? '2px solid #333' : 'none' }}
              >
                {t('gamification.adults')}
              </button>
              <button
                onClick={() => { setCategory('kids'); setBelt(''); }}
                style={{ padding: '6px 14px', fontWeight: category === 'kids' ? 'bold' : 'normal', borderBottom: category === 'kids' ? '2px solid #333' : 'none' }}
              >
                {t('gamification.kids')}
              </button>
            </div>

            {category === 'adults' && (
              <select value={belt} onChange={e => setBelt(e.target.value)} style={{ padding: 8 }}>
                <option value="">{t('gamification.allBelts')}</option>
                {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>

          {entries.length === 0 ? (
            <p>{t('common.noResults')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.rank')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.name')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.belt')}</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('gamification.totalPoints')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.rank}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.name}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.belt}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{e.totalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
