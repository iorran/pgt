import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { beltClasses } from '@/lib/belts';
import { Badge } from '@/components/ui/badge';
import {
  addMinutes,
  AFTER_END_MIN,
  classesOn,
  dateForWeekday,
  groupByStart,
  isoDate,
  minutesSince,
  slotState,
  teacherTitle,
  type ClassItem,
  type ClassTeacher,
  type SlotState,
} from '@/lib/schedule';

interface AcademyCheckin {
  id: string;
  date: string; // YYYY-MM-DD in the academy timezone
  student: { id: string; name: string };
  class: { id: string } | null;
}

export interface TimelineActionContext {
  // Null on any day but today: nothing can be checked into yet.
  state: SlotState | null;
  // The classes sharing this class's start time (itself included).
  group: ClassItem[];
}

// Monday first, like the calendar.
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

type Phase = 'past' | 'open-after' | 'live' | 'upcoming';

function groupPhase(states: SlotState[] | null): Phase {
  if (!states) {
    return 'upcoming';
  }
  if (states.some((s) => s === 'live' || s === 'soon')) {
    return 'live';
  }
  if (states.some((s) => s === 'open-after')) {
    return 'open-after';
  }
  if (states.every((s) => s === 'past')) {
    return 'past';
  }
  return 'upcoming';
}

// Re-renders every 30 s so "começou há" and the now line move on their own.
function useNow(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed) {
      return;
    }
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [fixed]);
  return fixed ?? now;
}

export function useDuration() {
  const { t } = useTranslation();
  return (minutes: number) => {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) {
      return t('classes.timeline.minutes', { count: m });
    }
    const h = Math.floor(m / 60);
    return m % 60 === 0
      ? t('classes.timeline.hours', { h })
      : t('classes.timeline.hoursMinutes', { h, m: String(m % 60).padStart(2, '0') });
  };
}

export function SeminarLabel({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-wider text-seminar', className)}>
      <Medal className="size-3.5" aria-hidden />
      {t('seminars.label')}
    </span>
  );
}

// "Professor Ana" / "Instrutor Bruno" by belt; a name alone for other belts; guests by name.
export function TeacherLine({
  teacher,
  guestTeacherName,
  className,
}: {
  teacher?: Pick<ClassTeacher, 'name' | 'belt'> | null;
  guestTeacherName?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (guestTeacherName) {
    return <span className={cn('block text-sm text-foreground/80', className)}>{t('classes.teacher.guest', { name: guestTeacherName })}</span>;
  }
  if (!teacher) {
    return null;
  }
  const title = teacherTitle(teacher.belt);
  return (
    <span className={cn('flex items-center gap-1.5 text-sm text-foreground/80', className)}>
      <span aria-hidden className={cn('inline-block h-1.5 w-5 rounded-sm ring-1 ring-white/40', beltClasses(teacher.belt))} />
      {title ? t(`classes.teacher.as${title}`, { name: teacher.name }) : teacher.name}
    </span>
  );
}

function LiveProgress({ classes, now, many }: { classes: ClassItem[]; now: Date; many: boolean }) {
  const { t } = useTranslation();
  const duration = useDuration();
  const first = classes[0];
  const states = classes.map((c) => slotState(c, now));
  if (states.every((s) => s === 'soon')) {
    return (
      <span className="block text-xs text-muted-foreground">
        {t('classes.timeline.startsIn', { time: duration(-minutesSince(first.startTime, now)) })}
      </span>
    );
  }
  const end = classes.map((c) => c.endTime).sort().at(-1)!;
  const elapsed = minutesSince(first.startTime, now);
  const total = Math.max(1, minutesSince(first.startTime, now) - minutesSince(end, now));
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return (
    <span className="block space-y-1">
      <span className="block h-1 overflow-hidden rounded-full bg-border">
        <span className="block h-1 bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="block text-xs text-muted-foreground">
        {t(many ? 'classes.timeline.startedAgoMany' : 'classes.timeline.startedAgo', {
          time: duration(elapsed),
          end: end.slice(0, 5),
        })}
      </span>
    </span>
  );
}

function Card({ onClick, className, children }: { onClick?: () => void; className: string; children: ReactNode }) {
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, 'text-left transition-colors hover:bg-muted/50')}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

// The day as a timeline: times on the left, a rail, and a card per class.
// Owner: cards open the class (onSelect) and list who is present today.
// Student: renderAction draws the card's own controls (check-in, seminar sign-up).
export function ClassTimeline({
  classes,
  onSelect,
  renderAction,
  now: fixedNow,
}: {
  classes: ClassItem[];
  onSelect?: (cls: ClassItem) => void;
  renderAction?: (cls: ClassItem, ctx: TimelineActionContext) => ReactNode;
  now?: Date;
}) {
  const { t, i18n } = useTranslation();
  const duration = useDuration();
  const now = useNow(fixedNow);
  const todayDow = now.getDay();
  const [day, setDay] = useState(todayDow);
  const isToday = day === todayDow;
  const date = dateForWeekday(day, now);

  // Refreshes every minute so the class on the mats fills up live.
  const { data: checkins = [] } = useQuery<AcademyCheckin[]>({
    queryKey: ['checkins', 'academy'],
    queryFn: () => api<AcademyCheckin[]>('/checkins/academy'),
    enabled: isToday && !renderAction,
    refetchInterval: 60_000,
  });
  const todayIso = isoDate(now);
  const presentBy = (classId: string) => checkins.filter((c) => c.date === todayIso && c.class?.id === classId);

  const groups = groupByStart(classesOn(classes, date));
  const states = groups.map((g) => (isToday ? g.map((c) => slotState(c, now)) : null));
  const phases = states.map(groupPhase);
  const liveIndex = phases.indexOf('live');
  const nextIndex = phases.indexOf('upcoming');
  // The now line marks where you are in the day when no class is on the mats.
  const nowLineAt = isToday && liveIndex === -1 && groups.length > 0 ? (nextIndex === -1 ? groups.length : nextIndex) : -1;

  // Open on the class that matters: the one on the mats, else where "now" is.
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView?.({ block: 'center' });
  }, [day]);

  const nowLine = (
    <li
      ref={liveIndex === -1 ? focusRef : undefined}
      className="grid min-h-10 grid-cols-[44px_18px_minmax(0,1fr)] items-center gap-x-2"
    >
      <span className="font-mono text-sm font-bold text-primary">
        {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
      </span>
      <span className="relative self-stretch">
        <span aria-hidden className="absolute inset-y-0 left-2 w-0.5 bg-border" />
        <span aria-hidden className="absolute left-[3px] top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary" />
      </span>
      <span className="flex items-center gap-2">
        <span className="font-heading text-sm uppercase tracking-wide text-primary">{t('classes.timeline.now')}</span>
        <span aria-hidden className="h-0.5 flex-1 bg-primary" />
        {nextIndex !== -1 && (
          <span className="text-xs text-muted-foreground">
            {t('classes.timeline.nextIn', { time: duration(-minutesSince(groups[nextIndex][0].startTime, now)) })}
          </span>
        )}
      </span>
    </li>
  );

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t('classes.daysOfWeek')} className="grid grid-cols-7 gap-1">
        {WEEK.map((d) => {
          const name = t(`classes.days.${DAY_KEYS[d]}`);
          const selected = d === day;
          const hasSeminar = classesOn(classes, dateForWeekday(d, now)).some((c) => c.isSeminar);
          return (
            <button
              key={d}
              type="button"
              aria-label={name}
              aria-pressed={selected}
              onClick={() => setDay(d)}
              className={`relative min-h-11 rounded-sm font-heading uppercase text-sm tracking-wide transition-colors ${
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {name.slice(0, 3)}
              {d === todayDow && !selected && (
                <span aria-hidden className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
              {hasSeminar && (
                <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-seminar ring-1 ring-background" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        {date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t('classes.noClassesOnDay')}</p>
      ) : (
        <ol className="flex flex-col">
          {groups.map((group, gi) => {
            const phase = phases[gi];
            const groupStates = states[gi];
            const many = group.length > 1;
            const end = group.map((c) => c.endTime).sort().at(-1)!;
            const seminarOnly = group.every((c) => c.isSeminar);
            const last = gi === groups.length - 1 && nowLineAt !== groups.length;
            return [
              gi === nowLineAt ? <Fragment key="now">{nowLine}</Fragment> : null,
              <li
                key={group[0].id}
                ref={gi === liveIndex ? focusRef : undefined}
                className={cn('grid grid-cols-[44px_18px_minmax(0,1fr)] gap-x-2', phase === 'past' && 'opacity-45')}
              >
                <span
                  className={cn(
                    'pt-3.5 font-mono text-sm leading-tight',
                    phase === 'live' && (seminarOnly ? 'font-bold text-seminar' : 'font-bold text-primary'),
                    phase === 'open-after' && 'text-muted-foreground',
                    phase === 'upcoming' && seminarOnly && 'text-seminar',
                  )}
                >
                  {group[0].startTime.slice(0, 5)}
                  <span className="block text-xs font-normal text-muted-foreground">{end.slice(0, 5)}</span>
                </span>
                <span className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-2 top-0 w-0.5',
                      last ? 'h-6' : 'bottom-0',
                      phase === 'live' ? (seminarOnly ? 'bg-seminar' : 'bg-primary') : 'bg-border',
                    )}
                  />
                  {phase === 'live' ? (
                    <>
                      <span aria-hidden className={cn('absolute left-0 top-4 size-[18px] rounded-full', seminarOnly ? 'bg-seminar/25' : 'bg-primary/25')} />
                      <span aria-hidden className={cn('absolute left-1 top-5 size-2.5 rounded-full', seminarOnly ? 'bg-seminar' : 'bg-primary')} />
                    </>
                  ) : seminarOnly ? (
                    <span aria-hidden className="absolute left-0.5 top-4 size-3.5 rounded-full bg-seminar" />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-[3px] top-[17px] size-3 rounded-full border-2 bg-background',
                        phase === 'upcoming' ? 'border-foreground' : 'border-muted-foreground',
                      )}
                    />
                  )}
                </span>
                <div className="mb-2.5 flex flex-col gap-2">
                  {many && phase === 'live' && (
                    <div className="space-y-1 pt-1">
                      <span className={cn('block font-heading text-sm uppercase tracking-wide', seminarOnly ? 'text-seminar' : 'text-primary')}>
                        {t(renderAction ? 'classes.timeline.manyChoose' : 'classes.timeline.many', { count: group.length })}
                      </span>
                      <LiveProgress classes={group} now={now} many />
                    </div>
                  )}
                  {phase === 'open-after' && (
                    <span className="block pt-1 text-xs text-muted-foreground">
                      {t(many ? 'classes.timeline.endedOpenMany' : 'classes.timeline.endedOpen', {
                        until: addMinutes(end, AFTER_END_MIN),
                      })}
                    </span>
                  )}
                  {group.map((cls, ci) => {
                    const state = groupStates ? groupStates[ci] : null;
                    const live = state === 'live';
                    const onMats = state === 'live' || state === 'soon';
                    const present = isToday ? presentBy(cls.id) : [];
                    return (
                      <Card
                        key={cls.id}
                        onClick={onSelect && (() => onSelect(cls))}
                        className={cn(
                          'w-full rounded-sm border bg-card p-3.5',
                          cls.isSeminar ? 'border-seminar' : onMats ? 'border-primary' : 'border-border',
                        )}
                      >
                        <span className="flex flex-col gap-2">
                          {cls.isSeminar && <SeminarLabel />}
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0 font-heading text-lg uppercase leading-tight">{cls.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              {live && (
                                <Badge className={cls.isSeminar ? 'bg-seminar text-seminar-foreground' : undefined}>
                                  {t('classes.now')}
                                </Badge>
                              )}
                              <Badge variant="outline">{cls.type}</Badge>
                            </span>
                          </span>
                          <TeacherLine teacher={cls.teacher} guestTeacherName={cls.guestTeacherName} />
                          {!many && onMats && <LiveProgress classes={[cls]} now={now} many={false} />}
                          {renderAction && renderAction(cls, { state, group })}
                          {!renderAction && isToday && (
                            <span className="block space-y-2">
                              <span className="block text-sm text-muted-foreground">
                                {t('classes.presentCount', { count: present.length })}
                              </span>
                              {present.length > 0 && (
                                <span className="flex flex-wrap gap-1">
                                  {present.map((c) => (
                                    <span key={c.id} className="rounded-sm bg-muted px-2 py-1 text-xs">
                                      {c.student.name}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </Card>
                    );
                  })}
                </div>
              </li>,
            ];
          })}
          {nowLineAt === groups.length && nowLine}
        </ol>
      )}
    </div>
  );
}
