import { useState } from 'react';
import { signIn } from '../lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await signIn.email({ email, password });
    if (error) setError(error.message);
    else navigate('/');
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email')}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: 10 }}>
          {t('auth.login')}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/signup">{t('auth.signup')}</Link>
      </p>
    </div>
  );
}
