import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';
import { QueryError } from '@/components/query-error';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

interface Order {
  id: string;
  productName?: string;
  studentName?: string;
  quantity: number;
  status: string;
  createdAt: string;
}

const statusClasses: Record<string, string> = {
  requested: 'bg-yellow-500/20 text-warning-text border-yellow-500/30',
  confirmed: 'bg-arena-cyan/20 text-arena-cyan border-arena-cyan/30',
  delivered: 'bg-primary/20 text-primary border-primary/30',
  cancelled: 'bg-destructive/20 text-danger-text border-destructive/30',
};

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<Order | null>(null);

  const orderUrl = isOwner(user)
    ? `/orders?academyId=${user?.academyId}`
    : `/orders/student/${user?.id}`;

  const orderKey = isOwner(user)
    ? ['orders', user?.academyId]
    : ['orders', 'student', user?.id];

  const { data: orders = [], isLoading, isError, refetch } = useApiQuery<Order[]>(
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
      setCancelling(null);
    },
  });

  if (isLoading) return <PageLoader />;

  const orderActions = (o: Order) => (
    <div className="flex flex-wrap gap-2">
      {o.status === 'requested' && (
        <>
          <Button size="sm" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'confirmed' })}>
            {t('marketplace.confirmOrder')}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setCancelling(o)}>
            {t('marketplace.cancelOrder')}
          </Button>
        </>
      )}
      {o.status === 'confirmed' && (
        <Button size="sm" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'delivered' })}>
          {t('marketplace.deliver')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.marketplace')} items={[
        { to: '/marketplace', label: t('marketplace.pageTitle') },
        { to: '/marketplace/orders', label: t('marketplace.ordersPageTitle') },
      ]} />

      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t('marketplace.noOrders')}
          description={t('emptyState.orders.description')}
          action={
            <Link to="/marketplace" className={buttonVariants({ variant: 'outline' })}>
              {t('marketplace.browseProducts')}
            </Link>
          }
          help="Gerenciar Pedidos"
          studentHelp="Fazer um Pedido"
        />
      ) : (
        <>
        <ul aria-label={t('marketplace.ordersPageTitle')} className="md:hidden divide-y divide-border rounded-sm border border-border">
          {orders.map(o => (
            <li key={o.id} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {o.productName || '—'} <span className="font-mono text-muted-foreground">×{o.quantity}</span>
                  </p>
                  {isOwner(user) && <p className="text-sm text-muted-foreground break-words">{o.studentName || '—'}</p>}
                  <p className="font-mono text-xs text-muted-foreground">{formatDate(o.createdAt, i18n.language)}</p>
                </div>
                <Badge className={statusClasses[o.status] || ''}>
                  {t(`marketplace.orderStatus.${o.status}`)}
                </Badge>
              </div>
              {isOwner(user) && orderActions(o)}
            </li>
          ))}
        </ul>
        <div className="hidden md:block rounded-sm border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>{t('marketplace.productName')}</TableHead>
                {isOwner(user) && (
                  <TableHead>{t('students.name')}</TableHead>
                )}
                <TableHead>{t('marketplace.quantity')}</TableHead>
                <TableHead>{t('marketplace.status')}</TableHead>
                <TableHead>{t('billing.date')}</TableHead>
                {isOwner(user) && (
                  <TableHead>{t('marketplace.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id} className="border-border">
                  <TableCell>{o.productName || '—'}</TableCell>
                  {isOwner(user) && (
                    <TableCell>{o.studentName || '—'}</TableCell>
                  )}
                  <TableCell className="font-mono">{o.quantity}</TableCell>
                  <TableCell>
                    <Badge className={statusClasses[o.status] || ''}>
                      {t(`marketplace.orderStatus.${o.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatDate(o.createdAt, i18n.language)}
                  </TableCell>
                  {isOwner(user) && (
                    <TableCell>{orderActions(o)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <Dialog open={!!cancelling} onOpenChange={(open) => { if (!open) { setCancelling(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{t('marketplace.cancelOrder')}</DialogTitle>
            <DialogDescription>{t('marketplace.confirmCancelOrder', { product: cancelling?.productName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>{t('common.back')}</Button>
            <Button
              variant="destructive"
              loading={updateStatusMutation.isPending}
              onClick={() => cancelling && updateStatusMutation.mutate({ orderId: cancelling.id, status: 'cancelled' })}
            >
              {t('marketplace.cancelOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
