import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { isActiveNow, type ClassItem } from '@/lib/schedule';

interface AcademyCheckin {
  id: string;
  date: string; // YYYY-MM-DD in the academy timezone
  student: { id: string; name: string };
  class: { id: string } | null;
}

// Monday first, like the calendar.
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ponytail: device-local date; matches the academy date unless the owner is in another timezone.
function localIsoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function ClassDayList({
  classes,
  onSelect,
}: {
  classes: ClassItem[];
  onSelect: (cls: ClassItem) => void;
}) {
  const { t } = useTranslation();
  const today = new Date().getDay();
  const [day, setDay] = useState(today);
  const isToday = day === today;

  // Refreshes every minute so the class on the mats fills up live.
  const { data: checkins = [] } = useQuery<AcademyCheckin[]>({
    queryKey: ['checkins', 'academy'],
    queryFn: () => api<AcademyCheckin[]>('/checkins/academy'),
    enabled: isToday,
    refetchInterval: 60_000,
  });
  const todayIso = localIsoDate(new Date());
  const presentBy = (classId: string) =>
    checkins.filter((c) => c.date === todayIso && c.class?.id === classId);

  const dayClasses = classes
    .filter((c) => c.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={t('classes.daysOfWeek')}
        className="grid grid-cols-7 gap-1"
      >
        {WEEK.map((d) => {
          const name = t(`classes.days.${DAY_KEYS[d]}`);
          const selected = d === day;
          return (
            <button
              key={d}
              type="button"
              aria-label={name}
              aria-pressed={selected}
              onClick={() => setDay(d)}
              className={`relative min-h-11 rounded-sm font-heading uppercase text-sm tracking-wide transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {name.slice(0, 3)}
              {d === today && !selected && (
                <span aria-hidden className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {dayClasses.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t('classes.noClassesOnDay')}</p>
      ) : (
        <ul className="space-y-2">
          {dayClasses.map((cls) => {
            const present = isToday ? presentBy(cls.id) : [];
            const live = isToday && isActiveNow(cls);
            return (
              <li key={cls.id}>
                <button
                  type="button"
                  onClick={() => onSelect(cls)}
                  className={`w-full rounded-sm border bg-card p-4 text-left transition-colors hover:bg-muted/50 ${
                    live ? 'border-primary' : 'border-border'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-sm text-muted-foreground">
                        {cls.startTime.slice(0, 5)} – {cls.endTime.slice(0, 5)}
                      </span>
                      <span className="block font-heading text-lg uppercase leading-tight">{cls.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {live && <Badge>{t('classes.now')}</Badge>}
                      <Badge variant="outline">{cls.type}</Badge>
                    </span>
                  </span>
                  {isToday && (
                    <span className="mt-3 block space-y-2">
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
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
