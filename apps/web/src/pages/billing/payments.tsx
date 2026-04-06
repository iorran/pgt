import { useState } from 'react';
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

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
  const [form, setForm] = useState({ studentId: '', amount: '', paymentDate: '', referenceMonth: '' });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createMutation.mutateAsync({ ...form, amount: Number(form.amount), academyId: user.academyId });
    setForm({ studentId: '', amount: '', paymentDate: '', referenceMonth: '' });
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (paymentsLoading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-5 space-y-6">
      <h1 className="font-heading uppercase tracking-wider text-lg">{t('billing.paymentsTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider text-base">
            {t('billing.recordPayment')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('billing.selectStudent')}</Label>
              <select
                value={form.studentId}
                onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                required
                className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">{t('billing.selectStudent')}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('billing.amount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('billing.date')}</Label>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('billing.referenceMonth')}</Label>
              <Input
                type="month"
                value={form.referenceMonth}
                onChange={e => setForm(f => ({ ...f, referenceMonth: e.target.value }))}
                required
              />
            </div>
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
