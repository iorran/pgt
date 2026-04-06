import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
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
  const [dialogOpen, setDialogOpen] = useState(false);
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
    setDialogOpen(false);
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

  if (loading) return <div className="p-6 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl uppercase tracking-tight">{t('marketplace.pageTitle')}</h1>

        {user?.role === 'instructor' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              {t('marketplace.addProduct')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('marketplace.addProduct')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('marketplace.productName')}</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketplace.description')}</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketplace.price')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('marketplace.stock')}</Label>
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">{t('common.save')}</Button>
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
                    onClick={() => handleRequest(p.id)}
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
