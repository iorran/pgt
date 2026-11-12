import { useState } from 'react';
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
import { BeltOptions } from '@/components/belt-options';
import { formatDate, formatMoney, formatMonth } from '@/lib/format';
import { familyErrorKey, invalidateFamilyQueries } from '@/pages/students/families';

interface Student {
  id: string;
  name: string;
  email: string;
  belt: string;
  phone?: string;
  dueDay?: number | null;
  membershipStartDate?: string | null;
  familyId?: string | null;
  familyName?: string | null;
  monthlyFee?: string | null;
  modalities?: Modality[];
  trainingNote?: string | null;
  dateOfBirth?: string | null;
  agreementId?: string | null;
  agreementKind?: AgreementKind | null;
  agreementCheckins?: number | null;
}

type AgreementKind = 'addOn' | 'recruited';

interface Agreement {
  id: string;
  name: string;
  sharePercent: number;
  addOnPrice: string | null;
  active: boolean;
  teachers: { id: string; name: string }[];
}

interface Modality {
  id: string;
  name: string;
}

// The academy's usual amounts: one-tap suggestions, never a plan.
const FEE_SUGGESTIONS = [45, 65, 60, 35];

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
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="px-2 pt-4 text-center sm:px-4">
            <p className="arena-stat text-2xl text-primary sm:text-3xl">{checkins.length}</p>
            <p className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground uppercase tracking-wider sm:text-xs">
              {t('students.totalClasses')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2 pt-4 text-center sm:px-4">
            <p className="arena-stat text-2xl text-primary sm:text-3xl">{profile?.streak?.currentStreak ?? 0}</p>
            <p className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground uppercase tracking-wider sm:text-xs">
              {t('students.currentStreak')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-2 pt-4 text-center sm:px-4">
            <p className="arena-stat text-2xl text-primary sm:text-3xl">{profile?.xp ?? 0}</p>
            <p className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground uppercase tracking-wider sm:text-xs">XP</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading uppercase tracking-wider text-base">{t('students.fee.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {student.monthlyFee != null ? (
            <p className="arena-stat text-lg">
              {formatMoney(student.monthlyFee, i18n.language)}
              {student.dueDay != null && (
                <span className="ml-2 text-sm text-muted-foreground">
                  · {t('students.dueDay')}: {student.dueDay}
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">{t('students.fee.none')}</p>
          )}
          {isOwner(user) && (
            <MonthlyFeeForm
              key={student.id}
              studentId={student.id}
              monthlyFee={student.monthlyFee}
              dueDay={student.dueDay}
            />
          )}
          {isOwner(user) && (
            <StudentFinanceForm
              key={`${student.id}-${student.agreementId}-${student.agreementKind}`}
              student={student}
            />
          )}
          {isOwner(user) && student.monthlyFee != null && (
            <Dialog open={payConfirmOpen} onOpenChange={setPayConfirmOpen}>
              <DialogTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
                {t('students.payMonth')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('students.payMonth')}</DialogTitle>
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

      {isOwner(user) && (
        <Card>
          <CardContent className="space-y-6 pt-4">
            <BeltForm key={`${student.id}-${student.belt}`} studentId={student.id} belt={student.belt} />
            <BirthDateForm
              key={`${student.id}-${student.dateOfBirth}`}
              studentId={student.id}
              dateOfBirth={student.dateOfBirth ?? null}
            />
          </CardContent>
        </Card>
      )}

      {isOwner(user) && (
        <TrainingCard
          key={student.id}
          studentId={student.id}
          modalityIds={(student.modalities ?? []).map(m => m.id)}
          trainingNote={student.trainingNote ?? ''}
        />
      )}

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
        : // The only member becomes the family's Responsible.
          api('/families', { method: 'POST', body: JSON.stringify({ name, memberIds: [studentId], responsibleId: studentId }) }),
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
            className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-base md:text-sm"
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

function MonthlyFeeForm({
  studentId,
  monthlyFee,
  dueDay,
}: {
  studentId: string;
  monthlyFee?: string | null;
  dueDay?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [fee, setFee] = useState(monthlyFee != null ? String(Number(monthlyFee)) : '');
  const [day, setDay] = useState(String(dueDay ?? 8));

  const mutation = useMutation({
    mutationFn: () =>
      api(`/students/${studentId}/membership`, {
        method: 'PUT',
        body: JSON.stringify({ monthlyFee: fee, dueDay: Number(day) }),
      }),
    meta: { successMessage: t('students.fee.saved') },
    onSuccess: () => invalidateFamilyQueries(queryClient),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="monthly-fee">{t('students.fee.amount')}</Label>
          <Input
            id="monthly-fee"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={e => setFee(e.target.value)}
            required
            className="max-w-40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee-due-day">{t('students.dueDay')}</Label>
          <Input
            id="fee-due-day"
            type="number"
            min={1}
            max={28}
            value={day}
            onChange={e => setDay(e.target.value)}
            required
            className="max-w-24"
          />
        </div>
      </div>
      <div role="group" aria-label={t('students.fee.suggestions')} className="flex flex-wrap gap-2">
        {FEE_SUGGESTIONS.map(amount => (
          <button
            key={amount}
            type="button"
            aria-pressed={fee !== '' && Number(fee) === amount}
            onClick={() => setFee(String(amount))}
            className={`min-h-11 px-4 rounded-sm text-sm transition-colors ${
              fee !== '' && Number(fee) === amount
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {formatMoney(amount, i18n.language)}
          </button>
        ))}
      </div>
      <Button type="submit" variant="outline" loading={mutation.isPending}>
        {t('students.fee.save')}
      </Button>
    </form>
  );
}

// Links the Student to at most one Teacher Agreement: with its Class Add-on or as a Recruited Student.
function StudentFinanceForm({ student }: { student: Student }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const queryClient = useQueryClient();
  const [agreementId, setAgreementId] = useState(student.agreementId ?? '');
  const [kind, setKind] = useState<AgreementKind | null>(student.agreementKind ?? null);
  const { data: all = [] } = useApiQuery<Agreement[]>(['agreements'], '/agreements');
  // A Student can't be linked to an agreement they teach in.
  const agreements = all.filter(
    a => (a.active || a.id === student.agreementId) && !a.teachers.some(teacher => teacher.id === student.id),
  );
  const agreement = agreements.find(a => a.id === agreementId);
  const kinds: AgreementKind[] = agreement ? (agreement.addOnPrice === null ? ['recruited'] : ['addOn', 'recruited']) : [];
  // With a single way to link (no Class Add-on), it is picked for the Owner.
  const chosen = kind && kinds.includes(kind) ? kind : kinds.length === 1 ? kinds[0] : null;
  const owes = Number(student.monthlyFee ?? 0) + (chosen === 'addOn' ? Number(agreement!.addOnPrice) : 0);
  const hint = agreement
    ? [
        chosen === 'recruited' && t('finance.student.recruitedShare', { percent: agreement.sharePercent, name: agreement.name }),
        agreement.id === student.agreementId &&
          student.agreementCheckins != null &&
          t('finance.student.checkins', { count: student.agreementCheckins, name: agreement.name }),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const mutation = useMutation({
    mutationFn: () =>
      api(`/students/${student.id}/finance`, {
        method: 'PUT',
        body: JSON.stringify(chosen ? { agreementId, kind: chosen } : { agreementId: null, kind: null }),
      }),
    meta: { successMessage: t('finance.student.saved') },
    onSuccess: () => {
      for (const key of ['student', 'students', 'overdue', 'finance-payouts', 'finance-balance', 'agreements']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      invalidateFamilyQueries(queryClient);
    },
  });

  return (
    <form
      className="space-y-4 border-t border-border pt-4"
      onSubmit={e => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="agreement">{t('finance.student.agreement')}</Label>
        <select
          id="agreement"
          value={agreement ? agreementId : ''}
          onChange={e => setAgreementId(e.target.value)}
          className="flex h-11 w-full rounded-sm border border-border bg-card px-3 py-2 text-base md:text-sm"
        >
          <option value="">{t('finance.student.none')}</option>
          {agreements.map(a => (
            <option key={a.id} value={a.id}>
              {[a.name, ...(a.teachers.length > 0 ? [a.teachers.map(teacher => teacher.name).join(', ')] : [])].join(' · ')}
            </option>
          ))}
        </select>
      </div>
      {agreement && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t('finance.student.how')}</legend>
          {kinds.map(k => (
            <label
              key={k}
              className={`flex min-h-11 items-start gap-3 rounded-md border p-3 ${
                chosen === k ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="agreement-kind"
                value={k}
                checked={chosen === k}
                onChange={() => setKind(k)}
                required
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-bold">
                  {k === 'addOn'
                    ? t('finance.student.kindAddOn', { price: formatMoney(agreement.addOnPrice!, locale) })
                    : t('finance.student.kindRecruited')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(k === 'addOn' ? 'finance.student.kindAddOnHint' : 'finance.student.kindRecruitedHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {hint && <p className="text-sm">{hint}</p>}
      {student.monthlyFee != null && (
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">{t('finance.student.owesPerMonth')}</span>
          <span className="arena-stat text-xl">{formatMoney(owes, locale)}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('finance.student.settingsHint')}</p>
      <Button type="submit" variant="outline" loading={mutation.isPending}>
        {t('finance.student.save')}
      </Button>
    </form>
  );
}

function BeltForm({ studentId, belt }: { studentId: string; belt: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(belt);

  const mutation = useMutation({
    mutationFn: () => api(`/students/${studentId}/belt`, { method: 'PUT', body: JSON.stringify({ belt: value }) }),
    meta: { successMessage: t('students.beltForm.saved') },
    onSuccess: () => {
      for (const key of ['student', 'students', 'leaderboard']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
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
        <Label htmlFor="student-belt">{t('students.belt')}</Label>
        <select
          id="student-belt"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-base md:text-sm"
        >
          <BeltOptions />
        </select>
      </div>
      <Button type="submit" variant="outline" loading={mutation.isPending}>
        {t('students.beltForm.save')}
      </Button>
    </form>
  );
}

function BirthDateForm({ studentId, dateOfBirth }: { studentId: string; dateOfBirth: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(dateOfBirth?.slice(0, 10) ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      api(`/students/${studentId}/birth-date`, {
        method: 'PUT',
        body: JSON.stringify({ dateOfBirth: value || null }),
      }),
    meta: { successMessage: t('students.birthDate.saved') },
    onSuccess: () => {
      for (const key of ['student', 'students', 'leaderboard']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
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
        <Label htmlFor="student-birth-date">{t('students.birthDate.label')}</Label>
        <Input
          id="student-birth-date"
          type="date"
          value={value}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => setValue(e.target.value)}
          aria-describedby="student-birth-date-hint"
        />
      </div>
      <Button type="submit" variant="outline" loading={mutation.isPending}>
        {t('students.birthDate.save')}
      </Button>
      <p id="student-birth-date-hint" className="w-full text-xs text-muted-foreground">
        {t('students.birthDate.hint')}
      </p>
    </form>
  );
}

function TrainingCard({
  studentId,
  modalityIds,
  trainingNote,
}: {
  studentId: string;
  modalityIds: string[];
  trainingNote: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(modalityIds);
  const [note, setNote] = useState(trainingNote);

  const { data: modalities = [] } = useApiQuery<Modality[]>(['modalities'], '/modalities');

  const mutation = useMutation({
    mutationFn: () =>
      api(`/students/${studentId}/training`, {
        method: 'PUT',
        body: JSON.stringify({ modalityIds: selected, trainingNote: note.trim() || null }),
      }),
    meta: { successMessage: t('students.training.saved') },
    onSuccess: () => {
      for (const key of ['student', 'students', 'modalities']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const toggle = (modalityId: string) =>
    setSelected(ids => (ids.includes(modalityId) ? ids.filter(m => m !== modalityId) : [...ids, modalityId]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading uppercase tracking-wider text-base">{t('students.training.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">{t('students.training.modalities')}</legend>
            <div className="flex flex-wrap gap-x-4">
              {modalities.map(m => (
                <label key={m.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    className="size-5 accent-primary"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="training-note">{t('students.training.note')}</Label>
            <textarea
              id="training-note"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              className="flex w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="outline" loading={mutation.isPending}>
            {t('students.training.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WaivedMonthsCard({ studentId }: { studentId: string }) {
  const { t, i18n } = useTranslation();
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
                  aria-label={t('families.unwaive', { month: formatMonth(w.referenceMonth, i18n.language) })}
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
