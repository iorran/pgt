import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { TabsNav } from '@/components/tabs-nav';

// Owners manage seasons/results; students only see their ranking and profile.
export function GamificationTabs({ title }: { title: string }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const items = isOwner(session?.user as { role?: string } | undefined)
    ? [
        { to: '/gamification', label: t('gamification.leaderboardTitle') },
        { to: '/gamification/seasons', label: t('gamification.seasonsTitle') },
        { to: '/gamification/results', label: t('gamification.resultsShort') },
      ]
    : [
        { to: '/gamification', label: t('gamification.leaderboardTitle') },
        { to: '/gamification/profile', label: t('gamification.profileShort') },
      ];
  return <TabsNav title={title} items={items} />;
}
