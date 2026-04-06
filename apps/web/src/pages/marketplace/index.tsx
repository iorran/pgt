import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
}

export default function MarketplacePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<Product[]>(`/products?academyId=${user.academyId}`)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created = await api<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({ ...form, price: Number(form.price), stock: Number(form.stock), academyId: user.academyId }),
    });
    setProducts(prev => [...prev, created]);
    setForm({ name: '', description: '', price: '', stock: '' });
    setShowForm(false);
  }

  async function handleRequest(productId: string) {
    try {
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ productId, studentId: user.id, quantity: 1 }),
      });
      setMsg(t('marketplace.requestSuccess'));
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg(t('marketplace.requestError'));
    }
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('marketplace.title')}</h1>

      {msg && <p style={{ color: 'green', fontWeight: 'bold' }}>{msg}</p>}

      {user?.role === 'instructor' && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px' }}>
            {showForm ? t('common.cancel') : t('marketplace.addProduct')}
          </button>
          {showForm && (
            <form onSubmit={handleCreate} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <input placeholder={t('marketplace.productName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: 8 }} />
              <input placeholder={t('marketplace.description')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ padding: 8 }} />
              <input type="number" step="0.01" placeholder={t('marketplace.price')} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required style={{ padding: 8 }} />
              <input type="number" placeholder={t('marketplace.stock')} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 10 }}>{t('common.save')}</button>
            </form>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {products.map(p => (
            <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
              <div style={{ width: '100%', height: 120, backgroundColor: '#f0f0f0', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                {t('marketplace.photo')}
              </div>
              <h3 style={{ margin: '0 0 4px' }}>{p.name}</h3>
              <p style={{ margin: '0 0 4px', color: '#666' }}>{t('marketplace.price')}: {p.price}</p>
              <p style={{ margin: '0 0 8px', color: '#888' }}>{t('marketplace.stock')}: {p.stock}</p>
              {user?.role === 'student' && (
                <button onClick={() => handleRequest(p.id)} style={{ padding: '6px 14px', width: '100%' }}>
                  {t('marketplace.request')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
