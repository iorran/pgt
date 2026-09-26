import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
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
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { beltClasses, beltKey } from '@/lib/belts';
import { formatDate, formatMoney } from '@/lib/format';
import { familyErrorKey, invalidateFamilyQueries } from '@/pages/students/families';

interface Student {
  id: string;
  name: string;
  email: string;
  belt: string;
  phone?: string;
  planName?: string;
  dueDay?: number;
  membershipStartDate?: string;
  familyId?: string | null;
  familyName?: string | null;
  agreedPrice?: string | null;
  planPrice?: string | null;
  monthlyFee?: string | null;
}

interface Payment {
  id: string;
  amount: number | string;
  paymentDate: string;
  referenceMonth: string;
  status?: string;
}

export default function StudentDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);

  const { data: student, isLoading: studentLoading } = useApiQuery<Student>(
    ['student', id!],
    `/students/${id}`,
    !!id,
  );

  const { data: payments = [], isLoading: paymentsLoading } = useApiQuery<Payment[]>(
    ['payments', 'student', id!],
    `/payments/student/${id}`,
    !!id,
  );

  const { data: plans = [] } = useApiQuery<any[]>(
    ['plans', user?.academyId],
    `/membership-plans?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: checkins = [] } = useApiQuery<any[]>(
    ['checkins', 'student', id!],
    `/checkins/student/${id}`,
    !!id,
  );

  const { data: profile } = useApiQuery<{
    xp: number;
    streak: { currentStreak: number; longestStreak: number };
    badges: any[];
  }>(
    ['gamification-profile', id!],
    `/gamification/profile/${id}`,
    !!id,
  );

  const isLoading = studentLoading || paymentsLoading;

  const assignMembershipMutation = useMutation({
    mutationFn: (body: { planId: string; startDate: string; dueDay: string }) =>
      api(`/students/${id}/membership`, {
        method: 'POST',
        body: JSON.stringify({ ...body, dueDay: Number(body.dueDay) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      form.reset();
      setDialogOpen(false);
    },
  });

  const quickPayMutation = useMutation({
    mutationFn: () =>
      api(`/payments/quick/${id}`, { method: 'POST' }),
    meta: { successMessage: t('students.paySuccess') },
    onSuccess: () => {
      setPayConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payments', 'student', id] });
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      queryClient.invalidateQueries({ queryKey: ['my-payment-status'] });
    },
  });

  const form = useForm({
    defaultValues: {
      planId: '',
      startDate: '',
      dueDay: '',
    },
    onSubmit: async ({ value }) => {
      await assignMembershipMutation.mutateAsync(value);
    },
  });

  if (isLoading) return <PageLoader />;
  if (!student) return <div className="text-muted-foreground">{t('common.noResults')}</div>;

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/students')}>
        {t('common.back')}
      </Button>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wider">{student.name}</h1>
          <Badge className={beltClasses(student.belt)}>{t(beltKey(student.belt))}</Badge>
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {/* Spreadsheet-imported students get placeholder *.local emails. */}
          {!student.email?.endsWith('.local') && <span>{student.email}</span>}
          {student.phone && <span>{student.phone}</span>}
          {student.familyId ? (
            <span>
              {t('families.family')}:{' '}
              <Link to="/students/families" className="text-primary hover:underline">
                {student.familyName}
              </Link>
            </span>
          ) : (
            isOwner(user) && <JoinFamilyDialog studentId={student.id} />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">{checkins.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              {t('students.totalClasses')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">{profile?.streak?.currentStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              {t('students.currentStreak')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="arena-stat text-3xl text-primary">{profile?.xp ?? 0}</p>
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
          {isOwner(user) && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) {
                  form.reset();
                }
              }}
            >
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                {t('students.assignMembership')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase tracking-wider">
                    {t('students.assignMembership')}
                  </DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                  }}
                  className="flex flex-col gap-4"
                >
                  <form.Field name="planId">
                    {(field) => (
                      <div className="space-y-2">
                        <Label>{t('students.planId')}</Label>
                        <select
                          value={field.state.value}
                          onChange={e => field.handleChange(e.target.value)}
                          required
                          className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                        >
                          <option value="">--</option>
                          {plans.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {formatMoney(p.price, i18n.language)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="startDate">
                    {(field) => (
                      <div className="space-y-2">
                        <Label>{t('students.startDate')}</Label>
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
                  <form.Field name="dueDay">
                    {(field) => (
                      <div className="space-y-2">
                        <Label>{t('students.dueDay')}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          required
                        />
                      </div>
                    )}
                  </form.Field>
                  <Button type="submit" loading={assignMembershipMutation.isPending}>
                    {t('common.save')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {student.planName ? (
            <div className="space-y-1">
              <p className="font-medium">{student.planName}</p>
              {student.dueDay && (
                <p className="text-sm text-muted-foreground">
                  {t('students.dueDay')}: {student.dueDay}
                </p>
              )}
              {student.planPrice != null && (
                <p className="text-sm text-muted-foreground">
                  {t('families.listPrice')}: {formatMoney(student.planPrice, i18n.language)}
                </p>
              )}
              {student.monthlyFee != null && (
                <p className="text-sm">
                  {t('families.monthlyFee')}: {formatMoney(student.monthlyFee, i18n.language)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">-</p>
          )}
          {isOwner(user) && student.planName && (
            <AgreedPriceForm key={student.agreedPrice ?? ''} studentId={student.id} agreedPrice={student.agreedPrice ?? ''} />
          )}
          {isOwner(user) && student.planName && (
            <Dialog open={payConfirmOpen} onOpenChange={setPayConfirmOpen}>
              <DialogTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
                {t('students.payCurrentMonth')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('students.payCurrentMonth')}</DialogTitle>
                  <DialogDescription>{t('students.payConfirm', { name: student.name })}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
                  <Button onClick={() => quickPayMutation.mutate()} loading={quickPayMutation.isPending}>
                    {t('common.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {isOwner(user) && <WaivedMonthsCard studentId={student.id} />}

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
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{formatDate(p.paymentDate, i18n.language)}</TableCell>
                    <TableCell className="arena-stat">{formatMoney(p.amount, i18n.language)}</TableCell>
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

function JoinFamilyDialog({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [familyId, setFamilyId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: families = [] } = useApiQuery<{ id: string; name: string }[]>(['families'], '/families', open);

  const mutation = useMutation({
    mutationFn: (target: 'existing' | 'new') =>
      target === 'existing'
        ? api(`/families/${familyId}/members`, { method: 'POST', body: JSON.stringify({ studentId }) })
        : api('/families', { method: 'POST', body: JSON.stringify({ name, memberIds: [studentId] }) }),
    meta: { silent: true, successMessage: t('families.saved') },
    onError: (err: Error) => setError(t(familyErrorKey(err))),
    onSuccess: () => {
      invalidateFamilyQueries(queryClient);
      setOpen(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        setOpen(o);
        setError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="self-start" />}>
        {t('families.addToFamily')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">{t('families.addToFamily')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-2"
          onSubmit={e => {
            e.preventDefault();
            mutation.mutate('existing');
          }}
        >
          <Label htmlFor="join-family">{t('families.existingFamily')}</Label>
          <select
            id="join-family"
            value={familyId}
            onChange={e => setFamilyId(e.target.value)}
            required
            className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">--</option>
            {families.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" loading={mutation.isPending && mutation.variables === 'existing'}>
            {t('families.add')}
          </Button>
        </form>
        <form
          className="flex flex-col gap-2"
          onSubmit={e => {
            e.preventDefault();
            mutation.mutate('new');
          }}
        >
          <Label htmlFor="new-family-name">{t('families.name')}</Label>
          <Input id="new-family-name" value={name} onChange={e => setName(e.target.value)} required />
          <Button type="submit" loading={mutation.isPending && mutation.variables === 'new'}>
            {t('common.create')}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgreedPriceForm({ studentId, agreedPrice }: { studentId: string; agreedPrice: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(agreedPrice);

  const mutation = useMutation({
    mutationFn: () =>
      api(`/students/${studentId}/membership`, {
        method: 'PUT',
        body: JSON.stringify({ agreedPrice: value || null }),
      }),
    meta: { successMessage: t('families.saved') },
    onSuccess: () => invalidateFamilyQueries(queryClient),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={e => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="agreed-price">{t('families.agreedPrice')}</Label>
        <Input
          id="agreed-price"
          type="number"
          min="0"
          step="0.01"
          placeholder={t('families.agreedPricePlaceholder')}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="max-w-40"
        />
      </div>
      <Button type="submit" variant="outline" loading={mutation.isPending}>
        {t('families.saveAgreedPrice')}
      </Button>
    </form>
  );
}

function WaivedMonthsCard({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState('');
  const [reason, setReason] = useState('');

  const { data: waived = [] } = useApiQuery<{ referenceMonth: string; reason: string | null }[]>(
    ['waived-months', studentId],
    `/students/${studentId}/waived-months`,
  );

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['waived-months', studentId] });
    invalidateFamilyQueries(queryClient);
  };

  const waiveMutation = useMutation({
    mutationFn: () =>
      api(`/students/${studentId}/waived-months`, {
        method: 'POST',
        body: JSON.stringify({ month, reason: reason || undefined }),
      }),
    meta: { successMessage: t('families.saved') },
    onSuccess: () => {
      setMonth('');
      setReason('');
      onSuccess();
    },
  });

  const unwaiveMutation = useMutation({
    mutationFn: (m: string) => api(`/students/${studentId}/waived-months/${m}`, { method: 'DELETE' }),
    onSuccess,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading uppercase tracking-wider text-base">{t('families.waivedMonths')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {waived.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('families.noWaivedMonths')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {waived.map(w => (
              <li key={w.referenceMonth} className="flex items-center justify-between gap-2 py-1">
                <span>
                  <span className="font-mono">{w.referenceMonth}</span>
                  {w.reason && <span className="text-muted-foreground"> · {w.reason}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${t('families.unwaive')} ${w.referenceMonth}`}
                  loading={unwaiveMutation.isPending && unwaiveMutation.variables === w.referenceMonth}
                  onClick={() => unwaiveMutation.mutate(w.referenceMonth)}
                >
                  {t('families.remove')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={e => {
            e.preventDefault();
            waiveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="waive-month">{t('families.month')}</Label>
            <Input id="waive-month" type="month" value={month} onChange={e => setMonth(e.target.value)} required />
          </div>
          <div className="space-y-2 flex-1 min-w-40">
            <Label htmlFor="waive-reason">{t('families.reason')}</Label>
            <Input id="waive-reason" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" loading={waiveMutation.isPending}>
            {t('families.waiveMonth')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
