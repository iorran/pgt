export interface ClassItem {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  instructor?: string;
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
      .filter((c) => c.dayOfWeek === dayDow)
      .map((c) => buildEvent(c, base));
  }

  if (range === 'week') {
    const monday = mondayOf(anchor);
    return classes.map((c) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offsetFromMonday(c.dayOfWeek));
      return buildEvent(c, date);
    });
  }

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = mondayOf(first);
  const gridEnd = mondayOf(last);
  gridEnd.setDate(gridEnd.getDate() + 6);

  const events: CalendarEvent[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    for (const c of classes) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + offsetFromMonday(c.dayOfWeek));
      events.push(buildEvent(c, date));
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return events;
}
