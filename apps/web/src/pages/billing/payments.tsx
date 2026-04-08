import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';

interface Payment {
  id: string;
  studentName?: string;
  amount: number;
  paymentDate: string;
  referenceMonth: string;
}

interface Student {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      studentId: '',
      amount: '',
      paymentDate: '',
      referenceMonth: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        ...value,
        amount: Number(value.amount),
        academyId: user.academyId,
      });
      form.reset();
    },
  });

  const { data: payments = [], isLoading: paymentsLoading } = useApiQuery<Payment[]>(
    ['payments', user?.academyId],
    `/payments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: students = [] } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      api<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (paymentsLoading) return <PageLoader />;

  return (
    <div className="p-5 space-y-6">
      <TabsNav items={[
        { to: '/billing', label: t('billing.overdueTitle') },
        { to: '/billing/plans', label: t('billing.plansTitle') },
        { to: '/billing/payments', label: t('billing.paymentsTitle') },
      ]} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider text-base">
            {t('billing.recordPayment')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <form.Field name="studentId">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('billing.selectStudent')}</Label>
                  <select
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">{t('billing.selectStudent')}</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>
            <form.Field name="amount">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('billing.amount')}</Label>
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
            <form.Field name="paymentDate">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('billing.date')}</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="referenceMonth">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('billing.referenceMonth')}</Label>
                  <Input
                    type="month"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                </div>
              )}
            </form.Field>
            <div className="md:col-span-2">
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading uppercase tracking-wider text-base mb-4">{t('billing.recentPayments')}</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
        ) : (
          <div className="rounded-sm border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('students.name')}</TableHead>
                  <TableHead>{t('billing.amount')}</TableHead>
                  <TableHead>{t('billing.date')}</TableHead>
                  <TableHead>{t('billing.referenceMonth')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.studentName || '-'}</TableCell>
                    <TableCell className="arena-stat">{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="font-mono">{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>{p.referenceMonth}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
