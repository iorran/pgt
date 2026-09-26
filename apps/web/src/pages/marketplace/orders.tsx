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
import { formatDate } from '@/lib/format';

interface Order {
  id: string;
  productName?: string;
  studentName?: string;
  quantity: number;
  status: string;
  createdAt: string;
}

const statusClasses: Record<string, string> = {
  requested: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30 dark:text-yellow-400',
  confirmed: 'bg-arena-cyan/20 text-arena-cyan border-arena-cyan/30',
  delivered: 'bg-primary/20 text-primary border-primary/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
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
      setCancelling(null);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.marketplace')} items={[
        { to: '/marketplace', label: t('marketplace.pageTitle') },
        { to: '/marketplace/orders', label: t('marketplace.ordersPageTitle') },
      ]} />

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <ShoppingBag className="size-12" />
          <p className="text-lg font-heading">{t('marketplace.noOrders')}</p>
          <Link to="/marketplace" className={buttonVariants({ variant: 'outline' })}>
            {t('marketplace.browseProducts')}
          </Link>
        </div>
      ) : (
        <div className="rounded-sm border border-border overflow-hidden">
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
                  <TableCell>{o.productName || '-'}</TableCell>
                  {isOwner(user) && (
                    <TableCell>{o.studentName || '-'}</TableCell>
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
                    <TableCell>
                      <div className="flex gap-2">
                        {o.status === 'requested' && (
                          <>
                            <Button size="sm" onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: 'confirmed' })}>
                              {t('common.confirm')}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setCancelling(o)}>
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

      <Dialog open={!!cancelling} onOpenChange={(open) => { if (!open) { setCancelling(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{t('marketplace.cancelOrder')}</DialogTitle>
            <DialogDescription>{t('marketplace.confirmCancelOrder')}</DialogDescription>
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
