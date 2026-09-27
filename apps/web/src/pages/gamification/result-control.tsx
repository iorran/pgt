import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { formatDate, signedPoints, todayYmd } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { POSITION_STYLES } from './submit-result-dialog';

export interface CompetitionResult {
  id: string;
  studentId?: string;
  competitionName: string;
  date: string;
  position: number | null;
  status: 'pending' | 'approved' | 'rejected';
  studentName?: string;
  pointsAwarded?: number;
  pointsOverridden?: boolean;
}

const POSITION_KEYS: Record<number, string> = {
  1: 'gamification.results.first',
  2: 'gamification.results.second',
  3: 'gamification.results.third',
};

const STATUSES = ['pending', 'approved', 'rejected'] as const;

const SELECT_CLASS = 'min-h-11 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm';

// Every place a result can change: ranking, both result lists and XP.
export function invalidateRanking(queryClient: QueryClient) {
  for (const key of ['leaderboard', 'competition-results', 'my-results', 'gamification-profile']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

// One dense result/adjustment row. `actions` holds page-specific primary buttons (approve/reject).
export function ResultRow({ result: r, showStudent, actions }: { result: CompetitionResult; showStudent?: boolean; actions?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  function cancelDelete() {
    setConfirmDelete(false);
    // Back to the row's own menu button, so keyboard users don't lose their place.
    requestAnimationFrame(() => menuRef.current?.focus());
  }

  return (
    <li className="rounded-sm border border-border bg-card px-3 py-2">
      {confirmDelete ? (
        <DeleteConfirm result={r} showStudent={showStudent} onCancel={cancelDelete} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            {showStudent && <p className="truncate font-heading text-sm">{r.studentName || '-'}</p>}
            <p className="truncate text-sm text-muted-foreground" title={r.competitionName}>
              {r.competitionName}
            </p>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{formatDate(r.date, i18n.language)}</span>
              <span>{t(`gamification.results.status.${r.status}`)}</span>
            </p>
          </div>
          <Badge className={`shrink-0 ${r.position ? POSITION_STYLES[r.position] || '' : ''}`} variant={r.position ? 'default' : 'outline'}>
            {r.position ? (POSITION_KEYS[r.position] ? t(POSITION_KEYS[r.position]) : `${r.position}º`) : t('gamification.control.adjustment')}
          </Badge>
          {r.status === 'approved' && (
            <span className="arena-stat shrink-0 font-mono text-sm text-primary">
              {signedPoints(r.pointsAwarded ?? 0)} {t('gamification.pointsShort')}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              ref={menuRef}
              render={<Button variant="ghost" size="icon" className="shrink-0" />}
              aria-label={t('gamification.control.actionsFor', { name: r.competitionName })}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem className="min-h-11" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => setConfirmDelete(true)}>
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {actions && <div className="flex w-full gap-2">{actions}</div>}
        </div>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider">{t('gamification.control.editTitle')}</DialogTitle>
          </DialogHeader>
          <EditResultForm result={r} onDone={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </li>
  );
}

// Destructive confirm in place of the row (no second overlay). Escape cancels.
function DeleteConfirm({ result, showStudent, onCancel }: { result: CompetitionResult; showStudent?: boolean; onCancel: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const textId = useId();
  const mutation = useMutation({
    mutationFn: () => api(`/competition-results/${result.id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRanking(queryClient),
    meta: { successMessage: t('gamification.control.deleted'), silent: true },
  });

  // After the menu hands focus back to its (now gone) trigger.
  useEffect(() => {
    const id = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-labelledby={textId}
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      }}
    >
      <div className="min-w-0 flex-1">
        {/* Which row is being deleted stays visible. */}
        <p className="flex gap-2 text-xs text-muted-foreground">
          {showStudent && <span className="shrink-0 font-heading">{result.studentName}</span>}
          <span className="truncate" title={result.competitionName}>
            {result.competitionName}
          </span>
        </p>
        <p id={textId} className="text-sm">
          {t('gamification.control.deleteInline')}
        </p>
      </div>
      {mutation.isError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('common.genericError')}
        </p>
      )}
      <Button ref={cancelRef} variant="outline" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="destructive" loading={mutation.isPending} onClick={() => mutation.mutate()}>
        {t('common.delete')}
      </Button>
    </div>
  );
}

// Mounted only while open, so each opening starts from the row's current values.
function EditResultForm({ result, onDone }: { result: CompetitionResult; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initialPoints = String(result.pointsAwarded ?? 0);
  const [competitionName, setCompetitionName] = useState(result.competitionName);
  const [competitionDate, setCompetitionDate] = useState(result.date.slice(0, 10));
  const [position, setPosition] = useState(result.position ? String(result.position) : '');
  const [status, setStatus] = useState<string>(result.status);
  const [points, setPoints] = useState(initialPoints);

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        competitionName,
        competitionDate,
        position: position ? Number(position) : null,
        status,
      };
      // Untouched points follow the season config (decision 2); typed points are kept as an override.
      if (points !== initialPoints) {
        body.pointsAwarded = Number(points);
      }
      return api(`/competition-results/${result.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      invalidateRanking(queryClient);
      onDone();
    },
    meta: { successMessage: t('gamification.control.saved'), silent: true },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="edit-competition">{t('gamification.results.competition')}</Label>
        <Input id="edit-competition" value={competitionName} onChange={(e) => setCompetitionName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-date">{t('gamification.results.date')}</Label>
        <Input id="edit-date" type="date" max={todayYmd()} value={competitionDate} onChange={(e) => setCompetitionDate(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="edit-position">{t('gamification.results.position')}</Label>
          <select id="edit-position" value={position} onChange={(e) => setPosition(e.target.value)} className={SELECT_CLASS}>
            <option value="1">{t('gamification.results.first')}</option>
            <option value="2">{t('gamification.results.second')}</option>
            <option value="3">{t('gamification.results.third')}</option>
            <option value="">{t('gamification.control.noPosition')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-status">{t('gamification.control.status')}</Label>
          <select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`gamification.results.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="edit-points">{t('gamification.control.points')}</Label>
          {result.pointsOverridden && <Badge variant="outline">{t('gamification.control.pointsOverridden')}</Badge>}
        </div>
        <Input
          id="edit-points"
          type="number"
          step={1}
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          aria-describedby="edit-points-help"
          required
        />
        <p id="edit-points-help" className="text-xs text-muted-foreground">
          {t('gamification.control.pointsHelp')}
        </p>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('common.genericError')}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        {t('common.save')}
      </Button>
    </form>
  );
}

interface Student {
  id: string;
  name: string;
}

// Point Adjustment ("Ajuste de pontos"). With `student` the student is fixed (student page); otherwise searched.
export function AdjustPointsDialog({ student, className }: { student?: Student; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant="outline" className={className} />}>{t('gamification.control.adjust')}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {t('gamification.control.adjust')}
            {student ? ` — ${student.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        <AdjustPointsForm student={student} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustPointsForm({ student, onDone }: { student?: Student; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState(student?.id ?? '');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [invalidPoints, setInvalidPoints] = useState(false);

  const { data: students = [] } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !student && !!user?.academyId,
  );

  // ponytail: exact-name match like SubmitResultDialog; duplicate names resolve to the first student.
  function pickStudent(input: HTMLInputElement) {
    setStudentQuery(input.value);
    const match = students.find((s) => s.name === input.value);
    input.setCustomValidity(match ? '' : t('gamification.results.student'));
    setStudentId(match?.id ?? '');
  }

  const mutation = useMutation({
    mutationFn: () =>
      api('/competition-results/adjustments', {
        method: 'POST',
        body: JSON.stringify({ studentId, points: Number(points), reason: reason.trim() }),
      }),
    onSuccess: () => {
      invalidateRanking(queryClient);
      onDone();
    },
    meta: { successMessage: t('gamification.control.adjusted'), silent: true },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(points);
        if (!Number.isInteger(n) || n === 0) {
          setInvalidPoints(true);
          return;
        }
        setInvalidPoints(false);
        mutation.mutate();
      }}
      className="space-y-4"
    >
      {!student && (
        <div className="space-y-2">
          <Label htmlFor="adjust-student">{t('gamification.results.student')}</Label>
          <Input
            id="adjust-student"
            list="adjust-student-options"
            autoComplete="off"
            value={studentQuery}
            onChange={(e) => pickStudent(e.target)}
            required
          />
          <datalist id="adjust-student-options">
            {students.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="adjust-points">{t('gamification.control.points')}</Label>
        <Input
          id="adjust-points"
          type="number"
          step={1}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          aria-describedby="adjust-points-help"
          aria-invalid={invalidPoints || undefined}
          required
        />
        <p id="adjust-points-help" className="text-xs text-muted-foreground">
          {t('gamification.control.adjustHelp')}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="adjust-reason">{t('gamification.control.reason')}</Label>
        <Input id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
      </div>
      {(invalidPoints || mutation.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {invalidPoints
            ? t('gamification.control.pointsNonZero')
            : mutation.error?.message === 'NO_SEASON_FOR_DATE'
              ? t('gamification.control.noSeasonToday')
              : t('common.genericError')}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        {t('common.save')}
      </Button>
    </form>
  );
}
