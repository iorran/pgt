import { describe, it, expect } from 'vitest';
import { classesToCalendarEvents } from '@/lib/schedule';

const cls = (over: Partial<{
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}> = {}) => ({
  id: 'c1',
  name: 'Morning Gi',
  type: 'gi',
  dayOfWeek: 2, // Tuesday
  startTime: '07:00',
  endTime: '08:30',
  ...over,
});

describe('classesToCalendarEvents', () => {
  it('week range: materializes class onto its dayOfWeek within the anchor week', () => {
    // Anchor: Wed 2026-04-22
    const anchor = new Date(2026, 3, 22);
    const events = classesToCalendarEvents([cls()], anchor, 'week');

    expect(events).toHaveLength(1);
    // Tuesday of the anchor week = 2026-04-21
    expect(events[0].start.toISOString()).toBe(new Date(2026, 3, 21, 7, 0).toISOString());
    expect(events[0].end.toISOString()).toBe(new Date(2026, 3, 21, 8, 30).toISOString());
    expect(events[0].title).toBe('Morning Gi');
    expect(events[0].resource.id).toBe('c1');
  });

  it('day range: only returns classes whose dayOfWeek matches the anchor day', () => {
    const tues = cls({ id: 'c1', dayOfWeek: 2, name: 'Tues class' });
    const thurs = cls({ id: 'c2', dayOfWeek: 4, name: 'Thurs class' });
    // Anchor: Thursday 2026-04-23
    const anchor = new Date(2026, 3, 23);
    const events = classesToCalendarEvents([tues, thurs], anchor, 'day');

    expect(events).toHaveLength(1);
    expect(events[0].resource.id).toBe('c2');
  });

  it('month range: repeats each class across every week in the rendered month window', () => {
    // April 2026 has 5 Tuesdays (7, 14, 21, 28) plus spillover.
    // Anchor: April 15, 2026.
    const anchor = new Date(2026, 3, 15);
    const events = classesToCalendarEvents([cls()], anchor, 'month');

    // Tuesdays in the April grid the calendar renders (Mon-start weeks):
    // Week 1: Mar 30 - Apr 5 → Tue Mar 31
    // Week 2: Apr 6 - Apr 12 → Tue Apr 7
    // Week 3: Apr 13 - Apr 19 → Tue Apr 14
    // Week 4: Apr 20 - Apr 26 → Tue Apr 21
    // Week 5: Apr 27 - May 3 → Tue Apr 28
    // ⇒ 5 events
    expect(events).toHaveLength(5);
    const days = events.map((e) => e.start.getDate()).sort((a, b) => a - b);
    expect(days).toEqual([7, 14, 21, 28, 31]);
  });

  it('DST: class at 08:00 stays at wall-clock 08:00 across a DST transition', () => {
    // EU DST forward: Sun 2026-03-29. Week containing it starts Mon 2026-03-23.
    const mon = cls({ id: 'c-mon', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' });
    const wed = cls({ id: 'c-wed', dayOfWeek: 3, startTime: '08:00', endTime: '09:00' });

    const anchor = new Date(2026, 2, 25); // Wed 2026-03-25
    const events = classesToCalendarEvents([mon, wed], anchor, 'week');

    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.start.getHours()).toBe(8);
      expect(e.start.getMinutes()).toBe(0);
      expect(e.end.getHours()).toBe(9);
    }
  });
});
