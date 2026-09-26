import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { isOwner, isStudent } from '@/lib/roles';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { TabsNav } from '@/components/tabs-nav';
import { formatMoney } from '@/lib/format';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  stock: number;
}

export default function MarketplacePage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useApiQuery<Product[]>(
    ['products', user?.academyId],
    `/products?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const saveMutation = useMutation({
    mutationFn: (params: { editId: string | null; body: any }) =>
      params.editId
        ? api<Product>(`/products/${params.editId}`, { method: 'PUT', body: JSON.stringify(params.body) })
        : api<Product>('/products', { method: 'POST', body: JSON.stringify(params.body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => api(`/products/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleting(null);
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
      const body = {
        ...value,
        price: Number(value.price),
        stock: Number(value.stock),
        ...(editId ? {} : { academyId: user.academyId }),
      };
      await saveMutation.mutateAsync({ editId, body });
      form.reset();
      setEditId(null);
      setDialogOpen(false);
    },
  });

  function openCreate() {
    setEditId(null);
    form.reset();
    setDialogOpen(true);
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    form.reset();
    form.setFieldValue('name', p.name);
    form.setFieldValue('description', p.description ?? '');
    form.setFieldValue('price', String(Number(p.price)));
    form.setFieldValue('stock', String(p.stock));
    setDialogOpen(true);
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.marketplace')} items={[
        { to: '/marketplace', label: t('marketplace.pageTitle') },
        { to: '/marketplace/orders', label: t('marketplace.ordersPageTitle') },
      ]} />
      <div className="flex items-center justify-between">
        {isOwner(user) && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { form.reset(); } }}>
            <DialogTrigger render={<Button />} onClick={openCreate}>
              {t('marketplace.addProduct')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">
                  {editId ? t('common.edit') : t('marketplace.addProduct')}
                </DialogTitle>
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
                      <Label htmlFor="product-name">{t('marketplace.productName')}</Label>
                      <Input
                        id="product-name"
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
                      <Label htmlFor="product-description">{t('marketplace.description')}</Label>
                      <Input
                        id="product-description"
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
                      <Label htmlFor="product-price">{t('marketplace.price')}</Label>
                      <Input
                        id="product-price"
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
                      <Label htmlFor="product-stock">{t('marketplace.stock')}</Label>
                      <Input
                        id="product-stock"
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <Button type="submit" className="w-full" loading={saveMutation.isPending}>{t('common.save')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {msg && (
        <p className="text-sm font-bold text-primary">{msg}</p>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Package className="size-12" />
          <p className="text-lg font-heading">{t('marketplace.noProducts')}</p>
          {isOwner(user) && <Button onClick={openCreate}>{t('marketplace.addProduct')}</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <Card key={p.id} className="rounded-sm overflow-hidden">
              <div className="bg-muted aspect-square flex items-center justify-center">
                <Package className="size-10 text-muted-foreground" />
              </div>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-heading text-lg">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="arena-stat text-xl md:text-2xl text-primary font-mono">
                    {formatMoney(p.price, i18n.language)}
                  </span>
                  <Badge variant="outline">
                    {t('marketplace.stock')}: {p.stock}
                  </Badge>
                </div>
                {isStudent(user) && (
                  <Button
                    variant="outline"
                    className="w-full h-11 hover:arena-glow"
                    onClick={() => orderMutation.mutate(p.id)}
                    loading={orderMutation.isPending}
                  >
                    {t('marketplace.request')}
                  </Button>
                )}
                {isOwner(user) && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(p)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => setDeleting(p)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open) { setDeleting(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{t('common.delete')}</DialogTitle>
            <DialogDescription>{t('marketplace.confirmDelete', { name: deleting?.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
