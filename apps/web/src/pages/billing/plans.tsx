import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Plan {
  id: string;
  name: string;
  price: number;
  frequency: string;
  classesPerWeek: number;
}

export default function PlansPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      price: '',
      frequency: 'monthly',
      classesPerWeek: '',
    },
    onSubmit: async ({ value }) => {
      const body = {
        ...value,
        price: Number(value.price),
        classesPerWeek: Number(value.classesPerWeek),
        academyId: user.academyId,
      };
      await saveMutation.mutateAsync({ editId, body });
      setEditId(null);
      setDialogOpen(false);
      form.reset();
    },
  });

  const { data: plans = [], isLoading } = useApiQuery<Plan[]>(
    ['plans', user?.academyId],
    `/membership-plans?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const saveMutation = useMutation({
    mutationFn: (params: { editId: string | null; body: any }) => {
      if (params.editId) {
        return api<Plan>(`/membership-plans/${params.editId}`, { method: 'PUT', body: JSON.stringify(params.body) });
      }
      return api<Plan>('/membership-plans', { method: 'POST', body: JSON.stringify(params.body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  function startEdit(plan: Plan) {
    setEditId(plan.id);
    form.reset();
    form.setFieldValue('name', plan.name);
    form.setFieldValue('price', String(plan.price));
    form.setFieldValue('frequency', plan.frequency);
    form.setFieldValue('classesPerWeek', String(plan.classesPerWeek));
    setDialogOpen(true);
  }

  function openCreate() {
    setEditId(null);
    form.reset();
    setDialogOpen(true);
  }

  function formatPrice(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (isLoading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading uppercase tracking-wider text-lg">{t('billing.plansTitle')}</h1>

        {user?.role === 'instructor' && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { form.reset(); } }}>
            <DialogTrigger render={<Button />} onClick={openCreate}>
              {t('billing.createPlan')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading uppercase tracking-wider">
                  {editId ? t('common.edit') : t('billing.createPlan')}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
                className="flex flex-col gap-4"
              >
                <form.Field name="name">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('billing.planName')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="price">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('billing.price')}</Label>
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
                <form.Field name="frequency">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('billing.frequency')}</Label>
                      <select
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                      >
                        <option value="monthly">{t('billing.monthly')}</option>
                        <option value="quarterly">{t('billing.quarterly')}</option>
                        <option value="yearly">{t('billing.yearly')}</option>
                      </select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="classesPerWeek">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('billing.classesPerWeek')}</Label>
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
                <Button type="submit">{editId ? t('common.save') : t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="arena-stat text-3xl text-primary">{formatPrice(p.price)}</p>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{p.frequency}</span>
                  <span>{p.classesPerWeek}x / {t('billing.week')}</span>
                </div>
                {user?.role === 'instructor' && (
                  <Button variant="outline" className="w-full mt-2" onClick={() => startEdit(p)}>
                    {t('common.edit')}
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
