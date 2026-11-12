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
import { SearchCombobox } from '@/components/search-combobox';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { TabsNav } from '@/components/tabs-nav';
import { FinanceTabs } from './finance-nav';
import { QueryError } from '@/components/query-error';
import { formatDate, formatMoney, todayYmd as today } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { Receipt } from 'lucide-react';

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
  monthlyFee?: string | null;
  agreementId?: string | null;
  agreementKind?: 'addOn' | 'recruited' | null;
}

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState('');

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
      setStudentId('');
    },
  });

  const { data: payments = [], isLoading: paymentsLoading, isError, refetch } = useApiQuery<Payment[]>(
    ['payments', user?.academyId],
    `/payments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: students = [] } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: agreements = [] } = useApiQuery<{ id: string; addOnPrice: string | null }[]>(['agreements'], '/agreements');

  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  function pickStudent(match: Student | null) {
    setStudentId(match?.id ?? '');
    form.setFieldValue('studentId', match?.id ?? '');
    if (match?.monthlyFee != null) {
      // What the student owes per month: Monthly Fee plus the Class Add-on when marked.
      const addOn =
        match.agreementKind === 'addOn' ? Number(agreements.find((a) => a.id === match.agreementId)?.addOnPrice ?? 0) : 0;
      form.setFieldValue('amount', String(Number(match.monthlyFee) + addOn));
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
      <FinanceTabs />
      <TabsNav label={t('finance.tabs.charges')} items={[
        { to: '/billing', label: t('billing.overdueTitle') },
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
              <SearchCombobox
                id="payment-student"
                items={students}
                value={students.find((s) => s.id === studentId) ?? null}
                onChange={(s) => pickStudent(s as Student | null)}
                required
              />
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
        {isError ? (
          <QueryError onRetry={() => void refetch()} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('billing.noPayments')}
            description={t('emptyState.payments.description')}
            help="Registrar um Pagamento"
          />
        ) : (
          <>
            <ul aria-label={t('billing.recentPayments')} className="md:hidden divide-y divide-border rounded-sm border border-border">
              {payments.map(p => (
                <li key={p.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-words">{studentNames.get(p.studentId) || '—'}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatDate(p.paymentDate, i18n.language)} · {p.referenceMonth}
                    </p>
                  </div>
                  <span className="arena-stat shrink-0">{formatMoney(p.amount, i18n.language)}</span>
                </li>
              ))}
            </ul>
            <div className="hidden md:block rounded-sm border border-border">
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
                      <TableCell>{studentNames.get(p.studentId) || '—'}</TableCell>
                      <TableCell className="arena-stat">{formatMoney(p.amount, i18n.language)}</TableCell>
                      <TableCell className="font-mono">{formatDate(p.paymentDate, i18n.language)}</TableCell>
                      <TableCell>{p.referenceMonth}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
