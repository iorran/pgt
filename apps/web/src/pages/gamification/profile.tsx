import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Award } from 'lucide-react';

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

  if (loading) return <div className="p-6 text-muted-foreground">{t('common.loading')}</div>;
  if (!profile) return <div className="p-6 text-muted-foreground">{t('common.noResults')}</div>;

  return (
    <div className="p-6 space-y-8">
      {/* XP Header */}
      <div className="text-center space-y-1">
        <div className="font-display text-6xl text-primary arena-glow">
          {profile.totalXp.toLocaleString()}
        </div>
        <p className="font-heading text-lg text-muted-foreground uppercase">{t('gamification.totalXp')}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-sm text-center">
          <CardContent className="p-6 space-y-1">
            <div className="arena-stat text-3xl font-mono text-primary">
              {profile.currentStreak}
            </div>
            <p className="text-sm text-muted-foreground">{t('gamification.currentStreakFire')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm text-center">
          <CardContent className="p-6 space-y-1">
            <div className="arena-stat text-3xl font-mono text-primary">
              {profile.longestStreak}
            </div>
            <p className="text-sm text-muted-foreground">{t('gamification.longestStreak')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm text-center">
          <CardContent className="p-6 space-y-1">
            <div className="arena-stat text-3xl font-mono text-primary">
              {profile.totalXp.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">{t('gamification.totalXp')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <div className="space-y-4">
        <h2 className="font-heading text-2xl uppercase">{t('gamification.badges')}</h2>
        {profile.badges.length === 0 ? (
          <p className="text-muted-foreground">{t('gamification.noBadges')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.badges.map(b => (
              <Card key={b.id} className="rounded-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                    <Award className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-base">{b.name}</p>
                    {b.description && (
                      <p className="text-sm text-muted-foreground">{b.description}</p>
                    )}
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      {new Date(b.earnedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
