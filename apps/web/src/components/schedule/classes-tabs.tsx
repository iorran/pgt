import { useTranslation } from 'react-i18next';
import { TabsNav } from '@/components/tabs-nav';

// The tabs of Aulas, the same for the Owner and a Student.
export function ClassesTabs() {
  const { t } = useTranslation();
  return (
    <TabsNav
      title={t('nav.classes')}
      items={[
        { to: '/classes', label: t('classes.title') },
        { to: '/classes/seminars', label: t('seminars.sectionTitle') },
        { to: '/classes/history', label: t('classes.checkinHistory') },
      ]}
    />
  );
}
