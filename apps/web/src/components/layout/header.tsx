import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '../../lib/auth-client';

export function Header() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #ddd' }}>
      <span>{session?.user?.name}</span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <select value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)} style={{ padding: 4 }}>
          <option value="pt-BR">Portugues</option>
          <option value="en">English</option>
        </select>
        <button onClick={() => signOut()}>{t('auth.logout')}</button>
      </div>
    </header>
  );
}
