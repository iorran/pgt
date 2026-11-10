import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useApiQuery } from '@/hooks/use-api';
import type { ClassItem } from '@/lib/schedule';
import { PageLoader } from '@/components/page-loader';
import { SubpageHeader } from '@/components/subpage-header';
import { SeminarLabel, TeacherLine } from '@/components/schedule/class-timeline';
import { ClassEditDialog, type ClassEditPatch } from '@/components/schedule/class-edit-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SeminarParticipant {
  id: string;
  kind: 'student' | 'outsider';
  studentId: string | null;
  name: string;
  phone: string | null;
  amount: string;
  paidAt: string | null;
}

type Adding = 'student' | 'outsider' | null;

// The Owner's view of one Seminar: who is in, who paid, and how much came in (ADR 0005).
export default function SeminarPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<Adding>(null);
  const [editingSeminar, setEditingSeminar] = useState(false);
  const [editing, setEditing] = useState<SeminarParticipant | null>(null);

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );
  const seminar = classes.find((c) => c.id === id && c.isSeminar);
  const participantsKey = ['seminar-participants', id];
  const { data: participants = [] } = useApiQuery<SeminarParticipant[]>(
    participantsKey,
    `/seminars/${id}/participants`,
    !!seminar,
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: participantsKey });
  const update = useMutation({
    mutationFn: (vars: { id: string; amount?: string; paid?: boolean }) =>
      api(`/seminar-participants/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount: vars.amount, paid: vars.paid }),
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (participantId: string) => api(`/seminar-participants/${participantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });
  const editSeminar = useMutation({
    mutationFn: (patch: ClassEditPatch) => api(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      setEditingSeminar(false);
    },
    meta: { successMessage: t('seminars.updated') },
  });

  if (isLoading) {
    return <PageLoader />;
  }
  if (!seminar) {
    return (
      <div className="space-y-4">
        <SubpageHeader title={t('seminars.back')} to="/classes" />
        <p className="text-muted-foreground">{t('seminars.notFound')}</p>
      </div>
    );
  }

  const money = (v: string | number) => formatMoney(v, i18n.language);
  const paid = participants.filter((p) => p.paidAt);
  const pending = participants.filter((p) => !p.paidAt);
  const sum = (ps: SeminarParticipant[]) => ps.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-5">
      <SubpageHeader title={t('seminars.back')} to="/classes" />
      <div className="space-y-1.5">
        <SeminarLabel />
        <h2 className="font-heading text-2xl uppercase leading-tight">{seminar.name}</h2>
        <p className="text-sm text-foreground/80">
          {seminar.date && new Date(`${seminar.date}T00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {seminar.startTime.slice(0, 5)} – {seminar.endTime.slice(0, 5)}
        </p>
        <TeacherLine teacher={seminar.teacher} guestTeacherName={seminar.guestTeacherName} />
        <p className="text-sm text-muted-foreground">
          {t('seminars.prices', { student: money(seminar.studentPrice ?? 0), outsider: money(seminar.outsiderPrice ?? 0) })}
          {' · '}
          <Button variant="link" className="h-auto p-0 text-seminar" onClick={() => setEditingSeminar(true)}>
            {t('seminars.edit')}
          </Button>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-sm border border-border bg-card p-2.5">
          <div className="font-mono text-xl">{participants.length}</div>
          <div className="text-xs text-muted-foreground">{t('seminars.participants', { count: participants.length })}</div>
        </div>
        <div className="rounded-sm border border-border bg-card p-2.5">
          <div className="font-mono text-xl text-success-text">{money(sum(paid))}</div>
          <div className="text-xs text-muted-foreground">{t('seminars.received', { count: paid.length })}</div>
        </div>
        <div className="rounded-sm border border-border bg-card p-2.5">
          <div className="font-mono text-xl text-seminar">{money(sum(pending))}</div>
          <div className="text-xs text-muted-foreground">{t('seminars.pendingTotal', { count: pending.length })}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 border-seminar text-seminar" onClick={() => setAdding('student')}>
          {t('seminars.addStudent')}
        </Button>
        <Button variant="outline" className="h-11 border-seminar text-seminar" onClick={() => setAdding('outsider')}>
          {t('seminars.addOutsider')}
        </Button>
      </div>

      {participants.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">{t('seminars.none')}</p>
      ) : (
        <ul className="border-t border-border">
          {participants.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-2.5 border-b border-border">
              <button type="button" onClick={() => setEditing(p)} className="flex flex-1 flex-col py-2 text-left">
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t(p.kind === 'student' ? 'seminars.kindStudent' : 'seminars.kindOutsider')}
                  {p.phone && ` · ${p.phone}`} · {money(p.amount)}
                  {p.paidAt && ` · ${formatDate(p.paidAt, i18n.language)}`}
                </span>
              </button>
              {p.paidAt ? (
                <Button
                  variant="ghost"
                  className="h-10 text-success-text"
                  aria-label={`${t('seminars.markPending')}: ${p.name}`}
                  onClick={() => update.mutate({ id: p.id, paid: false })}
                >
                  <Check aria-hidden />
                  {t('seminars.paid')}
                </Button>
              ) : (
                <Button
                  className="h-10 bg-seminar text-seminar-foreground hover:bg-seminar/90"
                  onClick={() => update.mutate({ id: p.id, paid: true })}
                >
                  {t('seminars.markPaid')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddParticipantDialog
        seminarId={id}
        adding={adding}
        existing={participants}
        onClose={() => setAdding(null)}
        onAdded={refresh}
      />
      <EditParticipantDialog
        participant={editing}
        onClose={() => setEditing(null)}
        onSave={(amount) => update.mutateAsync({ id: editing!.id, amount }).then(() => setEditing(null))}
        onRemove={() => remove.mutate(editing!.id)}
      />
      <ClassEditDialog
        cls={editingSeminar ? seminar : null}
        onOpenChange={(open) => !open && setEditingSeminar(false)}
        onSubmit={async (patch) => {
          await editSeminar.mutateAsync(patch);
        }}
      />
    </div>
  );
}

function AddParticipantDialog({
  seminarId,
  adding,
  existing,
  onClose,
  onAdded,
}: {
  seminarId: string;
  adding: Adding;
  existing: SeminarParticipant[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { data: students = [] } = useApiQuery<{ id: string; name: string; status: string }[]>(
    ['students'],
    '/students',
    adding === 'student',
  );
  const add = useMutation({
    mutationFn: (body: object) =>
      api(`/seminars/${seminarId}/participants`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      onAdded();
      setName('');
      setPhone('');
      setQuery('');
      onClose();
    },
  });

  const taken = new Set(existing.map((p) => p.studentId));
  const matches = students
    .filter((s) => s.status === 'active' && !taken.has(s.id))
    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 30);

  return (
    <Dialog open={adding !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {t(adding === 'outsider' ? 'seminars.addOutsider' : 'seminars.addStudent')}
          </DialogTitle>
        </DialogHeader>
        {adding === 'outsider' ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate({ name: name.trim(), phone: phone.trim() || undefined });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="outsider-name">{t('seminars.name')}</Label>
              <Input id="outsider-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outsider-phone">{t('seminars.phone')}</Label>
              <Input id="outsider-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" loading={add.isPending} disabled={!name.trim()}>
              {t('seminars.save')}
            </Button>
          </form>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="seminar-student-search">{t('classes.teacher.search')}</Label>
              <Input id="seminar-student-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <ul className="flex flex-col gap-0.5">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => add.mutate({ studentId: s.id })}
                    className="min-h-12 w-full rounded-sm px-3 text-left hover:bg-muted/50"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditParticipantDialog({
  participant,
  onClose,
  onSave,
  onRemove,
}: {
  participant: SeminarParticipant | null;
  onClose: () => void;
  onSave: (amount: string) => Promise<void>;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (participant && participant.id !== lastId) {
    setLastId(participant.id);
    setAmount(participant.amount);
  }
  return (
    <Dialog open={!!participant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">{participant?.name}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(amount);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="participant-amount">{t('seminars.amount')}</Label>
            <Input
              id="participant-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <Button type="submit">{t('seminars.save')}</Button>
          <Button type="button" variant="outline" className="text-danger-text" onClick={onRemove}>
            {t('seminars.remove')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
