import { useState } from 'react';
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
import { formatDate, formatMoney } from '@/lib/format';

interface Payment {
  id: string;
  studentId: string;
  amount: string | number;
  paymentDate: string;
  referenceMonth: string;
}

interface Student {
  id: string;
  name: string;
  planName?: string | null;
}

interface Plan {
  name: string;
  price: string | number;
}

// Local (not UTC) YYYY-MM-DD, so late-evening entries don't land on tomorrow.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [studentQuery, setStudentQuery] = useState('');

  const form = useForm({
    defaultValues: {
      studentId: '',
      amount: '',
      paymentDate: today(),
      referenceMonth: today().slice(0, 7),
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        ...value,
        amount: Number(value.amount),
        academyId: user.academyId,
      });
      form.reset();
      setStudentQuery('');
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

  const { data: plans = [] } = useApiQuery<Plan[]>(
    ['plans', user?.academyId],
    `/membership-plans?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  // ponytail: exact-name match; duplicate names resolve to the first student.
  function pickStudent(input: HTMLInputElement) {
    setStudentQuery(input.value);
    const match = students.find((s) => s.name === input.value);
    input.setCustomValidity(match ? '' : t('billing.selectStudent'));
    form.setFieldValue('studentId', match?.id ?? '');
    const plan = match && plans.find((p) => p.name === match.planName);
    if (plan) {
      form.setFieldValue('amount', String(Number(plan.price)));
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      api<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
    },
    meta: { successMessage: t('billing.paymentRecorded') },
  });

  if (paymentsLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.billing')} items={[
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
            <div className="space-y-2">
              <Label htmlFor="payment-student">{t('billing.selectStudent')}</Label>
              <Input
                id="payment-student"
                list="payment-student-options"
                autoComplete="off"
                value={studentQuery}
                onChange={(e) => pickStudent(e.target)}
                required
              />
              <datalist id="payment-student-options">
                {students.map(s => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <form.Field name="amount">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">{t('billing.amount')}</Label>
                  <Input
                    id="payment-amount"
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
                  <Label htmlFor="payment-paymentDate">{t('billing.date')}</Label>
                  <Input
                    id="payment-paymentDate"
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
                  <Label htmlFor="payment-referenceMonth">{t('billing.referenceMonth')}</Label>
                  <Input
                    id="payment-referenceMonth"
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
              <Button type="submit" loading={createMutation.isPending}>{t('common.save')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading uppercase tracking-wider text-base mb-4">{t('billing.recentPayments')}</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('billing.noPayments')}</p>
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
                    <TableCell>{studentNames.get(p.studentId) || '-'}</TableCell>
                    <TableCell className="arena-stat">{formatMoney(p.amount, i18n.language)}</TableCell>
                    <TableCell className="font-mono">{formatDate(p.paymentDate, i18n.language)}</TableCell>
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
