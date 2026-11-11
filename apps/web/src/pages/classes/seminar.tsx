import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Pencil } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { isGone } from '@/lib/api-errors';
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
  const navigate = useNavigate();
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
  // The participant was removed meanwhile: close their sheet (the list refetches globally).
  const closeIfGone = (err: Error) => {
    if (isGone(err)) {
      setEditing(null);
    }
  };
  const update = useMutation({
    mutationFn: (vars: { id: string; amount?: string; paid?: boolean }) =>
      api(`/seminar-participants/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount: vars.amount, paid: vars.paid }),
      }),
    onSuccess: refresh,
    onError: closeIfGone,
  });
  const remove = useMutation({
    mutationFn: (participantId: string) => api(`/seminar-participants/${participantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: closeIfGone,
  });
  const deleteSeminar = useMutation({
    mutationFn: () => api(`/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      queryClient.invalidateQueries({ queryKey: ['seminars'] });
      navigate('/classes/seminars', { replace: true });
    },
    meta: { successMessage: t('seminars.deleted') },
  });
  const editSeminar = useMutation({
    mutationFn: (patch: ClassEditPatch) => api(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      queryClient.invalidateQueries({ queryKey: ['seminars'] });
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
        <SubpageHeader title={t('seminars.sectionTitle')} to="/classes/seminars" />
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
      <div className="space-y-1.5">
        <SeminarLabel />
        <SubpageHeader title={seminar.name} to="/classes/seminars" />
        <p className="text-sm text-foreground/80">
          {seminar.date && new Date(`${seminar.date}T00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {seminar.startTime.slice(0, 5)} – {seminar.endTime.slice(0, 5)}
        </p>
        <TeacherLine teacher={seminar.teacher} guestTeacherName={seminar.guestTeacherName} />
        <p className="text-sm text-muted-foreground">
          {t('seminars.prices', { student: money(seminar.studentPrice ?? 0), outsider: money(seminar.outsiderPrice ?? 0) })}
        </p>
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={() => setEditingSeminar(true)}>
        <Pencil aria-hidden />
        {t('seminars.editTitle')}
      </Button>

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
              <button type="button" onClick={() => setEditing(p)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(p.kind === 'student' ? 'seminars.kindStudent' : 'seminars.kindOutsider')}
                    {p.phone && ` · ${p.phone}`} · {money(p.amount)}
                    {p.paidAt && ` · ${formatDate(p.paidAt, i18n.language)}`}
                  </span>
                </span>
                {/* Paid is a status: undoing it happens in the participant sheet. */}
                {p.paidAt && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-sm bg-success-text/15 px-2 py-1 text-xs font-heading uppercase text-success-text">
                      <Check className="size-3.5" aria-hidden />
                      {t('seminars.paid')}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </>
                )}
              </button>
              {!p.paidAt && (
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
        onMarkPending={() => update.mutateAsync({ id: editing!.id, paid: false }).then(() => setEditing(null))}
        onRemove={() => remove.mutate(editing!.id)}
      />
      <ClassEditDialog
        cls={editingSeminar ? seminar : null}
        onOpenChange={(open) => !open && setEditingSeminar(false)}
        onSubmit={async (patch) => {
          await editSeminar.mutateAsync(patch);
        }}
        onDelete={async () => {
          await deleteSeminar.mutateAsync();
        }}
        deleteMessage={t('seminars.confirmDelete', {
          name: seminar.name,
          count: participants.length,
          paid: money(sum(paid)),
        })}
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
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain">
            <div className="space-y-2">
              <Label htmlFor="seminar-student-search">{t('classes.teacher.search')}</Label>
              <Input id="seminar-student-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {matches.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
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
  onMarkPending,
  onRemove,
}: {
  participant: SeminarParticipant | null;
  onClose: () => void;
  onSave: (amount: string) => Promise<void>;
  onMarkPending: () => Promise<void>;
  onRemove: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [amount, setAmount] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (participant && participant.id !== lastId) {
    setLastId(participant.id);
    setAmount(participant.amount);
    setConfirmingRemove(false);
  }
  const money = (v: string) => formatMoney(v, i18n.language);
  return (
    <Dialog open={!!participant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">{participant?.name}</DialogTitle>
        </DialogHeader>
        {participant && (
          <p className={participant.paidAt ? 'flex items-center gap-1.5 text-success-text' : 'text-seminar'}>
            {participant.paidAt && <Check className="size-4" aria-hidden />}
            {participant.paidAt
              ? t('seminars.paidOn', { date: formatDate(participant.paidAt, i18n.language) })
              : t('seminars.pending')}
            {' · '}
            {money(participant.amount)}
          </p>
        )}
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
          {participant?.paidAt && (
            <Button type="button" variant="outline" onClick={() => void onMarkPending()}>
              {t('seminars.backToPending')}
            </Button>
          )}
        </form>
        {!confirmingRemove ? (
          <Button type="button" variant="outline" className="text-danger-text" onClick={() => setConfirmingRemove(true)}>
            {t('seminars.remove')}
          </Button>
        ) : (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {participant?.paidAt
                ? t('seminars.confirmRemovePaid', { name: participant.name, amount: money(participant.amount) })
                : t('seminars.confirmRemove', { name: participant?.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmingRemove(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={onRemove}>
                {t('seminars.remove')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
