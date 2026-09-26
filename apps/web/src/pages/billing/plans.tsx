import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
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
import { TabsNav } from '@/components/tabs-nav';
import { formatMoney } from '@/lib/format';

interface Plan {
  id: string;
  name: string;
  price: string | number;
  frequency: string;
  classesPerWeek: number | null;
}

export default function PlansPage() {
  const { t, i18n } = useTranslation();
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
        // Empty = unlimited ("Livre").
        classesPerWeek: value.classesPerWeek ? Number(value.classesPerWeek) : null,
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
    form.setFieldValue('classesPerWeek', plan.classesPerWeek ? String(plan.classesPerWeek) : '');
    setDialogOpen(true);
  }

  function openCreate() {
    setEditId(null);
    form.reset();
    setDialogOpen(true);
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.billing')} items={[
        { to: '/billing', label: t('billing.overdueTitle') },
        { to: '/billing/plans', label: t('billing.plansTitle') },
        { to: '/billing/payments', label: t('billing.paymentsTitle') },
      ]} />
      <div className="flex items-center justify-between">
        {isOwner(user) && (
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
                      <Label htmlFor="plan-name">{t('billing.planName')}</Label>
                      <Input
                        id="plan-name"
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
                      <Label htmlFor="plan-price">{t('billing.price')}</Label>
                      <Input
                        id="plan-price"
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
                      <Label htmlFor="plan-frequency">{t('billing.frequency')}</Label>
                      <select
                        id="plan-frequency"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
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
                      <Label htmlFor="plan-classesPerWeek">{t('billing.classesPerWeek')}</Label>
                      <Input
                        id="plan-classesPerWeek"
                        type="number"
                        min="1"
                        placeholder={t('billing.unlimitedClasses')}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </form.Field>
                <Button type="submit" loading={saveMutation.isPending}>{editId ? t('common.save') : t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('billing.noPlans')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-lg uppercase">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="arena-stat text-3xl text-primary">{formatMoney(p.price, i18n.language)}</p>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{t(`billing.${p.frequency}`)}</span>
                  <span>
                    {p.classesPerWeek ? `${p.classesPerWeek}x / ${t('billing.week')}` : t('billing.unlimitedClasses')}
                  </span>
                </div>
                {isOwner(user) && (
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
