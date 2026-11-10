import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { beltClasses, beltKey } from '@/lib/belts';
import { teacherTitle, type ClassTeacher } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TeacherLine } from './class-timeline';

interface Candidate extends ClassTeacher {
  role: 'student' | 'owner';
}

export interface TeacherValue {
  teacherId: string | null;
  guestTeacherName: string | null;
}

// Black first, then brown and purple: the people who usually teach.
const BELT_ORDER = ['black', 'brown', 'purple'];

// Any Student or the Owner can teach; the belt and the title it implies are shown to help the choice.
export function TeacherField({
  id,
  value,
  onChange,
  allowGuest = false,
}: {
  id: string;
  value: TeacherValue;
  onChange: (value: TeacherValue) => void;
  allowGuest?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [guest, setGuest] = useState(value.guestTeacherName ?? '');
  const { data: candidates = [] } = useApiQuery<Candidate[]>(['teacher-candidates'], '/teachers/candidates');

  const selected = candidates.find((c) => c.id === value.teacherId) ?? null;
  const matches = candidates.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const titled = matches
    .filter((c) => teacherTitle(c.belt))
    .sort((a, b) => BELT_ORDER.indexOf(a.belt) - BELT_ORDER.indexOf(b.belt) || a.name.localeCompare(b.name));
  const others = matches.filter((c) => !teacherTitle(c.belt));

  function pick(next: TeacherValue) {
    onChange(next);
    setOpen(false);
  }

  function row(c: Candidate) {
    const title = teacherTitle(c.belt);
    const isSelected = c.id === value.teacherId;
    return (
      <li key={c.id}>
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => pick({ teacherId: c.id, guestTeacherName: null })}
          className={cn(
            'flex min-h-12 w-full items-center gap-2.5 rounded-sm border px-3 text-left',
            isSelected ? 'border-primary bg-muted' : 'border-transparent hover:bg-muted/50',
          )}
        >
          <span className="flex-1">
            {c.name}
            {c.role === 'owner' && <span className="text-xs text-muted-foreground"> ({t('classes.teacher.owner')})</span>}
          </span>
          <span className={cn('rounded-sm px-2 py-0.5 text-xs ring-1 ring-white/40', beltClasses(c.belt))}>{t(beltKey(c.belt))}</span>
          {title && (
            <span className="rounded-full border border-muted-foreground px-2 py-0.5 text-xs font-semibold">
              {t(`classes.teacher.title${title}`)}
            </span>
          )}
          {isSelected && <Check className="size-4 text-primary" aria-hidden />}
        </button>
      </li>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('classes.teacher.label')}</Label>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-border bg-card px-3 text-left"
      >
        {selected || value.guestTeacherName ? (
          <TeacherLine teacher={selected} guestTeacherName={value.guestTeacherName} />
        ) : (
          <span className="text-muted-foreground">{t('classes.teacher.none')}</span>
        )}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider">{t('classes.teacher.pick')}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor={`${id}-search`}>{t('classes.teacher.search')}</Label>
              <Input id={`${id}-search`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <ul className="flex flex-col gap-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => pick({ teacherId: null, guestTeacherName: null })}
                  className="min-h-12 w-full rounded-sm px-3 text-left text-muted-foreground hover:bg-muted/50"
                >
                  {t('classes.teacher.none')}
                </button>
              </li>
              {titled.length > 0 && (
                <li className="px-3 pb-1 pt-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
                  {t('classes.teacher.teachers')}
                </li>
              )}
              {titled.map(row)}
              {others.length > 0 && (
                <li className="px-3 pb-1 pt-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">
                  {t('classes.teacher.others')}
                </li>
              )}
              {others.map(row)}
            </ul>
            {allowGuest && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor={`${id}-guest`}>{t('classes.teacher.guestLabel')}</Label>
                <Input
                  id={`${id}-guest`}
                  value={guest}
                  placeholder={t('classes.teacher.guestPlaceholder')}
                  onChange={(e) => setGuest(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!guest.trim()}
                  onClick={() => pick({ teacherId: null, guestTeacherName: guest.trim() })}
                >
                  {t('classes.teacher.guestUse')}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('classes.teacher.titleHint')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
