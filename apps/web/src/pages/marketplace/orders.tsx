import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';

interface Order {
  id: string;
  productName?: string;
  studentName?: string;
  quantity: number;
  status: string;
  createdAt: string;
}

const statusClasses: Record<string, string> = {
  pending: '',
  confirmed: 'bg-arena-cyan/20 text-arena-cyan border-arena-cyan/30',
  delivered: 'bg-primary/20 text-primary border-primary/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const orderUrl = user?.role === 'instructor'
    ? `/orders?academyId=${user?.academyId}`
    : `/orders/student/${user?.id}`;

  const orderKey = user?.role === 'instructor'
    ? ['orders', user?.academyId]
    : ['orders', 'student', user?.id];

  const { data: orders = [], isLoading } = useApiQuery<Order[]>(
    orderKey,
    orderUrl,
    !!user,
  );

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <TabsNav items={[
        { to: '/marketplace', label: t('marketplace.pageTitle') },
        { to: '/marketplace/orders', label: t('marketplace.ordersPageTitle') },
      ]} />

      {orders.length === 0 ? (
        <p className="text-muted-foreground">{t('common.noResults')}</p>
      ) : (
        <div className="rounded-sm border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>{t('marketplace.productName')}</TableHead>
                {user?.role === 'instructor' && (
                  <TableHead>{t('students.name')}</TableHead>
                )}
                <TableHead>{t('marketplace.quantity')}</TableHead>
                <TableHead>{t('marketplace.status')}</TableHead>
                <TableHead>{t('billing.date')}</TableHead>
                {user?.role === 'instructor' && (
                  <TableHead>{t('marketplace.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id} className="border-border">
                  <TableCell>{o.productName || '-'}</TableCell>
                  {user?.role === 'instructor' && (
                    <TableCell>{o.studentName || '-'}</TableCell>
                  )}
                  <TableCell className="font-mono">{o.quantity}</TableCell>
                  <TableCell>
                    <Badge className={statusClasses[o.status] || ''}>
                      {t(`marketplace.orderStatus.${o.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                  {user?.role === 'instructor' && (
                    <TableCell>
                      <div className="flex gap-2">
                        {o.status === 'requested' && (
                          <>
                            <Button size="sm" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'confirmed' })}>
                              {t('common.confirm')}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'cancelled' })}>
                              {t('common.cancel')}
                            </Button>
                          </>
                        )}
                        {o.status === 'confirmed' && (
                          <Button size="sm" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'delivered' })}>
                            {t('marketplace.deliver')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
