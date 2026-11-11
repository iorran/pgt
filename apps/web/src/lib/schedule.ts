export interface ClassTeacher {
  id: string;
  name: string;
  belt: string;
}

export interface ClassItem {
  id: string;
  name: string;
  type: string;
  recurrence?: 'weekly' | 'once';
  dayOfWeek: number;
  date?: string | null; // YYYY-MM-DD, one-off classes only
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  teacher?: ClassTeacher | null;
  guestTeacherName?: string | null;
  isSeminar?: boolean;
  studentPrice?: string | null;
  outsiderPrice?: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ClassItem;
}

export type CalendarRange = 'month' | 'week' | 'day';

function parseHHmm(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map((n) => parseInt(n, 10));
  return { h, m };
}

function mondayOf(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const js = d.getDay();
  const diff = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + diff);
  return d;
}

function offsetFromMonday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
}

function buildEvent(cls: ClassItem, date: Date): CalendarEvent {
  const { h: sh, m: sm } = parseHHmm(cls.startTime);
  const { h: eh, m: em } = parseHHmm(cls.endTime);
  const start = new Date(date);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(date);
  end.setHours(eh, em, 0, 0);
  return {
    id: cls.id,
    title: cls.name,
    start,
    end,
    resource: cls,
  };
}

export function classesToCalendarEvents(
  classes: ClassItem[],
  anchor: Date,
  range: CalendarRange,
): CalendarEvent[] {
  if (range === 'day') {
    const dayDow = anchor.getDay();
    const base = new Date(anchor);
    base.setHours(0, 0, 0, 0);
    return classes
      .filter((c) => c.dayOfWeek === dayDow && occursOn(c, base))
      .map((c) => buildEvent(c, base));
  }

  if (range === 'week') {
    const monday = mondayOf(anchor);
    return classes.flatMap((c) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offsetFromMonday(c.dayOfWeek));
      return occursOn(c, date) ? [buildEvent(c, date)] : [];
    });
  }

  // RBC month view always renders a fixed 6-week grid so we don't under-fill
  // when the month aligns with week boundaries (e.g. 1st on Mon + last on Sun).
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 6 * 7 - 1);

  const events: CalendarEvent[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    for (const c of classes) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + offsetFromMonday(c.dayOfWeek));
      if (occursOn(c, date)) {
        events.push(buildEvent(c, date));
      }
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return events;
}

// Today's YYYY-MM-DD in the academy's timezone (how the API dates check-ins); the device's day while unknown.
export function academyToday(timeZone: string | undefined, now: Date = new Date()): string {
  return timeZone ? new Intl.DateTimeFormat('en-CA', { timeZone }).format(now) : isoDate(now);
}

export function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// A one-off class happens only on its date; a weekly one on its weekday.
function occursOn(cls: ClassItem, day: Date): boolean {
  if (cls.recurrence === 'once') {
    return cls.date === isoDate(day);
  }
  return cls.dayOfWeek === day.getDay();
}

const toMin = (hhmm: string) => {
  const { h, m } = parseHHmm(hhmm);
  return h * 60 + m;
};

export const BEFORE_START_MIN = 15;
export const AFTER_END_MIN = 60;

// Where a class of today stands at `now`. Check-in is open in soon, live and open-after.
export type SlotState = 'upcoming' | 'soon' | 'live' | 'open-after' | 'past';

export function slotState(cls: ClassItem, now: Date = new Date()): SlotState {
  const n = now.getHours() * 60 + now.getMinutes();
  const start = toMin(cls.startTime);
  const end = toMin(cls.endTime);
  if (n < start - BEFORE_START_MIN) {
    return 'upcoming';
  }
  if (n < start) {
    return 'soon';
  }
  if (n < end) {
    return 'live';
  }
  if (n <= end + AFTER_END_MIN) {
    return 'open-after';
  }
  return 'past';
}

// Check-in window: from 15 min before start until 1 h after the end.
export function isActiveNow(cls: ClassItem, now: Date = new Date()): boolean {
  if (!occursOn(cls, now)) {
    return false;
  }
  const state = slotState(cls, now);
  return state === 'soon' || state === 'live' || state === 'open-after';
}

// Today and the days after it, at midnight, in order.
export function nextDays(count: number, today: Date = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// The next date (today included) that falls on `dow`.
export function dateForWeekday(dow: number, today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return d;
}

export function classesOn(classes: ClassItem[], day: Date): ClassItem[] {
  return classes.filter((c) => occursOn(c, day));
}

// Classes that start together share a slot on the timeline.
export function groupByStart(classes: ClassItem[]): ClassItem[][] {
  const sorted = [...classes].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );
  const groups: ClassItem[][] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].startTime === c.startTime) {
      last.push(c);
    } else {
      groups.push([c]);
    }
  }
  return groups;
}

// Glossary: black belt = Professor, purple/brown = Instructor; other belts teach without a title.
export function teacherTitle(belt?: string | null): 'Professor' | 'Instructor' | null {
  if (belt === 'black') {
    return 'Professor';
  }
  if (belt === 'purple' || belt === 'brown') {
    return 'Instructor';
  }
  return null;
}

export function minutesSince(hhmm: string, now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes() - toMin(hhmm);
}

export function addMinutes(hhmm: string, minutes: number): string {
  const total = (((toMin(hhmm) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
