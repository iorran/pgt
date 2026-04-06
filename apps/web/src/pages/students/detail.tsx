import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

interface Student {
  id: string;
  name: string;
  email: string;
  belt: string;
  phone?: string;
  plan?: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  referenceMonth: string;
  status?: string;
}

const BELT_CLASSES: Record<string, string> = {
  white: 'bg-gray-200 text-gray-800',
  blue: 'bg-belt-blue text-white',
  purple: 'bg-belt-purple text-white',
  brown: 'bg-belt-brown text-white',
  black: 'bg-belt-black text-white',
};

function getBeltClasses(belt: string) {
  return BELT_CLASSES[belt?.toLowerCase()] || 'bg-gray-200 text-gray-800';
}

export default function StudentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ planId: '', startDate: '', dueDay: '' });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<Student>(`/students/${id}`),
      api<Payment[]>(`/payments/student/${id}`),
    ])
      .then(([s, p]) => { setStudent(s); setPayments(p); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAssignMembership(e: React.FormEvent) {
    e.preventDefault();
    await api(`/students/${id}/membership`, {
      method: 'POST',
      body: JSON.stringify({ ...memberForm, dueDay: Number(memberForm.dueDay) }),
    });
    setDialogOpen(false);
    const s = await api<Student>(`/students/${id}`);
    setStudent(s);
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (loading) return <div className="p-5 text-muted-foreground">{t('common.loading')}</div>;
  if (!student) return <div className="p-5 text-muted-foreground">{t('common.noResults')}</div>;

  return (
    <div className="p-5 space-y-6">
      <Button variant="outline" onClick={() => navigate('/students')}>
        {t('common.back')}
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wider">{student.name}</h1>
          <Badge className={getBeltClasses(student.belt)}>{student.belt}</Badge>
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>{student.email}</span>
          {student.phone && <span>{student.phone}</span>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">--</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              {t('students.totalClasses')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">--</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              {t('students.currentStreak')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">--</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">XP</p>
          </CardContent>
        </Card>
      </div>

      {/* Membership info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="font-heading uppercase tracking-wider text-base">
            {t('students.plan')}
          </CardTitle>
          {user?.role === 'instructor' && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                {t('students.assignMembership')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase tracking-wider">
                    {t('students.assignMembership')}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAssignMembership} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label>{t('students.planId')}</Label>
                    <Input
                      value={memberForm.planId}
                      onChange={e => setMemberForm(f => ({ ...f, planId: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('students.startDate')}</Label>
                    <Input
                      type="date"
                      value={memberForm.startDate}
                      onChange={e => setMemberForm(f => ({ ...f, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('students.dueDay')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={memberForm.dueDay}
                      onChange={e => setMemberForm(f => ({ ...f, dueDay: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit">{t('common.save')}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <p>{student.plan || '-'}</p>
        </CardContent>
      </Card>

      {/* Payment history */}
      <div>
        <h2 className="font-heading uppercase tracking-wider text-base mb-4">{t('students.paymentHistory')}</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('common.noResults')}</p>
        ) : (
          <div className="rounded-sm border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.date')}</TableHead>
                  <TableHead>{t('billing.amount')}</TableHead>
                  <TableHead>{t('billing.referenceMonth')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell className="arena-stat">{formatCurrency(p.amount)}</TableCell>
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
