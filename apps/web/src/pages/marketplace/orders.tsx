import { useEffect, useState } from 'react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Order {
  id: string;
  productName?: string;
  studentName?: string;
  quantity: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#ca8a04',
  confirmed: '#2563eb',
  delivered: '#16a34a',
  cancelled: '#dc2626',
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const url = user.role === 'instructor'
      ? `/orders?academyId=${user.academyId}`
      : `/orders/student/${user.id}`;
    api<Order[]>(url)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user?.id, user?.role, user?.academyId]);

  async function updateStatus(orderId: string, status: string) {
    await api(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  }

  if (loading) return <div>{t('common.loading')}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{t('marketplace.ordersTitle')}</h1>
      {orders.length === 0 ? (
        <p>{t('common.noResults')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('marketplace.productName')}</th>
              {user?.role === 'instructor' && (
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('students.name')}</th>
              )}
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('marketplace.quantity')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('marketplace.status')}</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('billing.date')}</th>
              {user?.role === 'instructor' && (
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd' }}>{t('marketplace.actions')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{o.productName || '-'}</td>
                {user?.role === 'instructor' && (
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{o.studentName || '-'}</td>
                )}
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{o.quantity}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <span style={{ color: STATUS_COLORS[o.status] || '#333', fontWeight: 'bold' }}>{t(`marketplace.orderStatus.${o.status}`)}</span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                {user?.role === 'instructor' && (
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', gap: 4 }}>
                    {o.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(o.id, 'confirmed')} style={{ padding: '4px 8px' }}>{t('common.confirm')}</button>
                        <button onClick={() => updateStatus(o.id, 'cancelled')} style={{ padding: '4px 8px', color: 'red' }}>{t('common.cancel')}</button>
                      </>
                    )}
                    {o.status === 'confirmed' && (
                      <button onClick={() => updateStatus(o.id, 'delivered')} style={{ padding: '4px 8px' }}>{t('marketplace.deliver')}</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
