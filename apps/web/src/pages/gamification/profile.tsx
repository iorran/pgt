import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface GamificationProfile {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  badges: { id: string; name: string; description?: string; earnedAt: string }[];
}

export default function GamificationProfilePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api<GamificationProfile>(`/gamification/profile/${user.id}`)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <div>{t('common.loading')}</div>;
  if (!profile) return <div>{t('common.noResults')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('gamification.profileTitle')}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{profile.totalXp}</div>
          <div style={{ color: '#666' }}>{t('gamification.totalXp')}</div>
        </div>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{profile.currentStreak}</div>
          <div style={{ color: '#666' }}>{t('gamification.currentStreak')}</div>
        </div>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{profile.longestStreak}</div>
          <div style={{ color: '#666' }}>{t('gamification.longestStreak')}</div>
        </div>
      </div>

      <h2>{t('gamification.badges')}</h2>
      {profile.badges.length === 0 ? (
        <p>{t('gamification.noBadges')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {profile.badges.map(b => (
            <div key={b.id} style={{ padding: 14, border: '1px solid #ddd', borderRadius: 8 }}>
              <strong>{b.name}</strong>
              {b.description && <p style={{ margin: '4px 0', color: '#666', fontSize: 14 }}>{b.description}</p>}
              <p style={{ margin: 0, color: '#999', fontSize: 12 }}>{new Date(b.earnedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
