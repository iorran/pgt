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

  it('month range: always materializes 6 weeks (RBC month view height)', () => {
    // Anchor: April 15, 2026. Grid: Mon Mar 30 → Sun May 10 (6 weeks).
    const anchor = new Date(2026, 3, 15);
    const events = classesToCalendarEvents([cls()], anchor, 'month');

    // 6 Tuesdays: Mar 31, Apr 7, 14, 21, 28, May 5.
    expect(events).toHaveLength(6);
    const days = events.map((e) => e.start.getDate()).sort((a, b) => a - b);
    expect(days).toEqual([5, 7, 14, 21, 28, 31]);
  });

  it('month range: fills 6 weeks even when the 1st of the month is Monday', () => {
    // June 2026: Jun 1 is Mon, Jun 30 is Tue. Naive grids return only 5 weeks.
    // Grid: Mon Jun 1 → Sun Jul 12. 6 Tuesdays: Jun 2, 9, 16, 23, 30, Jul 7.
    const anchor = new Date(2026, 5, 15);
    const events = classesToCalendarEvents([cls()], anchor, 'month');

    expect(events).toHaveLength(6);
    const days = events.map((e) => e.start.getDate()).sort((a, b) => a - b);
    expect(days).toEqual([2, 7, 9, 16, 23, 30]);
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
