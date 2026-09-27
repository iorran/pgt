import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { todayYmd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const POSITION_STYLES: Record<number, string> = {
  1: 'bg-arena-gold/20 text-arena-gold border-arena-gold/30',
  2: 'bg-arena-silver/20 text-arena-silver border-arena-silver/30',
  3: 'bg-arena-bronze/20 text-arena-bronze border-arena-bronze/30',
};

// Selected podium option: solid medal-coloured border so the choice reads at a glance on a dark screen.
const SELECTED_STYLES: Record<number, string> = {
  1: 'border-arena-gold bg-arena-gold/25 text-arena-gold',
  2: 'border-arena-silver bg-arena-silver/25 text-arena-silver',
  3: 'border-arena-bronze bg-arena-bronze/25 text-arena-bronze',
};

export const PODIUM = [
  { position: 1, medal: '🥇', key: 'gamification.results.first' },
  { position: 2, medal: '🥈', key: 'gamification.results.second' },
  { position: 3, medal: '🥉', key: 'gamification.results.third' },
];

interface Student {
  id: string;
  name: string;
}

// Students send their own result (pending); owners register one for any student (approved at once).
export function SubmitResultDialog({ owner = false, className }: { owner?: boolean; className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = t(owner ? 'gamification.results.register' : 'gamification.results.submit');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className={className} />}>{title}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">{title}</DialogTitle>
        </DialogHeader>
        <ResultForm owner={owner} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so every opening starts from a blank form.
function ResultForm({ owner, onDone }: { owner: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState(owner ? '' : user?.id);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDate, setCompetitionDate] = useState('');
  const [position, setPosition] = useState(0);

  const { data: students = [] } = useApiQuery<Student[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    owner && !!user?.academyId,
  );

  // ponytail: exact-name match like billing/payments; duplicate names resolve to the first student.
  function pickStudent(input: HTMLInputElement) {
    setStudentQuery(input.value);
    const match = students.find((s) => s.name === input.value);
    input.setCustomValidity(match ? '' : t('gamification.results.student'));
    setStudentId(match?.id ?? '');
  }

  const mutation = useMutation({
    mutationFn: () =>
      api('/competition-results', {
        method: 'POST',
        body: JSON.stringify({ studentId, competitionName, competitionDate, position }),
      }),
    onSuccess: () => {
      for (const key of ['my-results', 'leaderboard', 'seasons', 'competition-results']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      onDone();
    },
    // Errors show inline (translated) so the dialog stays open.
    meta: {
      successMessage: t(owner ? 'gamification.results.registered' : 'gamification.results.submitted'),
      silent: true,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      {owner && (
        <div className="space-y-2">
          <Label htmlFor="result-student">{t('gamification.results.student')}</Label>
          <Input
            id="result-student"
            list="result-student-options"
            autoComplete="off"
            value={studentQuery}
            onChange={(e) => pickStudent(e.target)}
            required
          />
          <datalist id="result-student-options">
            {students.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="result-competition">{t('gamification.results.competition')}</Label>
        <Input
          id="result-competition"
          value={competitionName}
          onChange={(e) => setCompetitionName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="result-date">{t('gamification.results.date')}</Label>
        <Input
          id="result-date"
          type="date"
          max={todayYmd()}
          value={competitionDate}
          onChange={(e) => setCompetitionDate(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <p id="result-position" className="text-sm font-medium">
          {t('gamification.results.position')}
        </p>
        {/* Native radios (visually hidden) give arrow-key navigation and `required` for free. */}
        <div role="radiogroup" aria-labelledby="result-position" className="grid grid-cols-3 gap-2">
          {PODIUM.map((p) => (
            <label
              key={p.position}
              className={cn(
                'relative flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-sm border-2 text-base font-heading uppercase transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                position === p.position ? SELECTED_STYLES[p.position] : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name="result-position"
                value={p.position}
                checked={position === p.position}
                onChange={() => setPosition(p.position)}
                className="sr-only"
                required
              />
              <span aria-hidden className="text-2xl leading-none">
                {p.medal}
              </span>
              {t(p.key)}
              {position === p.position && (
                <Check data-selected-mark aria-hidden className="absolute right-1.5 top-1.5 size-4" />
              )}
            </label>
          ))}
        </div>
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message === 'NO_SEASON_FOR_DATE'
            ? t('gamification.results.noSeasonForDate')
            : t('common.genericError')}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        {t(owner ? 'gamification.results.registerSubmit' : 'gamification.results.send')}
      </Button>
    </form>
  );
}
