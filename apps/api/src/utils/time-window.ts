interface ClassSchedule {
  recurrence: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string;
  endTime: string;
}

const BUFFER_BEFORE_MIN = 15;
const BUFFER_AFTER_MIN = 60;

/**
 * True iff `at` falls within [startTime - 15min, endTime + 60min] as seen in
 * the academy's IANA timezone `tz`. For weekly classes, also checks that the
 * day-of-week in `tz` matches `cls.dayOfWeek`. For one-time classes, checks
 * that the calendar date in `tz` matches `cls.date` (YYYY-MM-DD).
 */
export function isClassActiveNow(cls: ClassSchedule, at: Date = new Date(), tz: string): boolean {
  // Derive hour/minute/weekday/calendar-date as seen in `tz`.
  const { hour, minute, weekday, isoDate } = getWallClockInTz(at, tz);

  if (cls.recurrence === 'weekly') {
    if (cls.dayOfWeek !== weekday) return false;
  } else {
    if (cls.date !== isoDate) return false;
  }

  const [startH, startM] = cls.startTime.split(':').map(Number);
  const [endH, endM] = cls.endTime.split(':').map(Number);

  const nowMinutes = hour * 60 + minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const windowStart = startMinutes - BUFFER_BEFORE_MIN;
  const windowEnd = endMinutes + BUFFER_AFTER_MIN;

  return nowMinutes >= windowStart && nowMinutes <= windowEnd;
}

interface WallClock {
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday ... 6 = Saturday (matches Date#getDay)
  isoDate: string; // YYYY-MM-DD in the given tz
}

function getWallClockInTz(at: Date, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  let hour = Number(parts.hour);
  // Intl with hour12: false occasionally emits '24' at midnight; normalize.
  if (hour === 24) hour = 0;

  return {
    hour,
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}
