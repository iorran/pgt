import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TabsNav } from '@/components/tabs-nav';

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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const { data: products = [], isLoading } = useApiQuery<Product[]>(
    ['products', user?.academyId],
    `/products?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      api<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const orderMutation = useMutation({
    mutationFn: (productId: string) =>
      api('/orders', {
        method: 'POST',
        body: JSON.stringify({ productId, studentId: user.id, quantity: 1 }),
      }),
    onSuccess: () => {
      setMsg(t('marketplace.requestSuccess'));
      setTimeout(() => setMsg(''), 3000);
    },
    onError: () => {
      setMsg(t('marketplace.requestError'));
    },
  });

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      price: '',
      stock: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        ...value,
        price: Number(value.price),
        stock: Number(value.stock),
        academyId: user.academyId,
      });
      form.reset();
      setDialogOpen(false);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <TabsNav items={[
        { to: '/marketplace', label: t('marketplace.pageTitle') },
        { to: '/marketplace/orders', label: t('marketplace.ordersPageTitle') },
      ]} />
      <div className="flex items-center justify-between">
        {user?.role === 'instructor' && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { form.reset(); } }}>
            <DialogTrigger render={<Button />}>
              {t('marketplace.addProduct')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('marketplace.addProduct')}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
                className="space-y-4"
              >
                <form.Field name="name">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('marketplace.productName')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="description">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('marketplace.description')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="price">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('marketplace.price')}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="stock">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('marketplace.stock')}</Label>
                      <Input
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <Button type="submit" className="w-full" loading={createMutation.isPending}>{t('common.save')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {msg && (
        <p className="text-sm font-bold text-primary">{msg}</p>
      )}

      {products.length === 0 ? (
        <p className="text-muted-foreground">{t('common.noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <Card key={p.id} className="rounded-sm overflow-hidden">
              <div className="bg-muted h-40 flex items-center justify-center">
                <Package className="size-10 text-muted-foreground" />
              </div>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-heading text-lg">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="arena-stat text-2xl text-primary font-mono">
                    R$ {p.price.toFixed(2).replace('.', ',')}
                  </span>
                  <Badge variant="outline">
                    {t('marketplace.stock')}: {p.stock}
                  </Badge>
                </div>
                {user?.role === 'student' && (
                  <Button
                    variant="outline"
                    className="w-full hover:arena-glow"
                    onClick={() => orderMutation.mutate(p.id)}
                    loading={orderMutation.isPending}
                  >
                    {t('marketplace.request')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
