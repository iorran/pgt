import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/auth-client';

export function Sidebar() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const location = useLocation();
  const isInstructor = session?.user?.role === 'instructor';

  const navItems = [
    { to: '/', label: t('nav.dashboard'), show: true },
    { to: '/classes', label: t('nav.classes'), show: true },
    { to: '/students', label: t('nav.students'), show: isInstructor },
    { to: '/billing', label: t('nav.billing'), show: isInstructor },
    { to: '/marketplace', label: t('nav.marketplace'), show: true },
    { to: '/gamification', label: t('nav.gamification'), show: true },
    { to: '/tournaments', label: t('nav.tournaments'), show: true },
  ];

  return (
    <nav style={{ width: 220, borderRight: '1px solid #ddd', padding: 16, minHeight: '100vh' }}>
      <h2 style={{ marginBottom: 24 }}>{t('app.name')}</h2>
      {navItems.filter(i => i.show).map(item => (
        <Link
          key={item.to}
          to={item.to}
          style={{
            display: 'block',
            padding: '8px 12px',
            marginBottom: 4,
            textDecoration: 'none',
            borderRadius: 4,
            backgroundColor: location.pathname === item.to ? '#f0f0f0' : 'transparent',
            color: '#333',
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
