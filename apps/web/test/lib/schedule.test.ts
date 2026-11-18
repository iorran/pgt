import { describe, it, expect } from 'vitest';
import { academyClock, academyNow, academyToday, classesToCalendarEvents, isoDate, nextClassToday } from '@/lib/schedule';

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

describe('academyToday', () => {
  // 23:30 UTC on Tuesday 10 Nov 2026: already Wednesday in Auckland, still Tuesday in São Paulo.
  const at = new Date('2026-11-10T23:30:00Z');

  it("is the academy's day, not the device's", () => {
    expect(academyToday('Pacific/Auckland', at)).toBe('2026-11-11');
    expect(academyToday('America/Sao_Paulo', at)).toBe('2026-11-10');
  });

  it("falls back to the device's day when the timezone is unknown", () => {
    expect(academyToday(undefined, at)).toBe(isoDate(at));
  });
});

describe('academyClock', () => {
  it('reads the wall clock in the academy timezone, not the device one', () => {
    // 07:36 UTC = 07:36 in Lisbon (winter) = 08:36 in Brussels
    const at = new Date('2026-11-18T07:36:00Z');
    expect(academyClock('Europe/Lisbon', at)).toEqual({ date: '2026-11-18', time: '07:36', minutes: 456 });
    expect(academyClock('Europe/Brussels', at).time).toBe('08:36');
  });
});

describe('nextClassToday', () => {
  const at = new Date('2026-11-18T07:36:00Z'); // Wednesday, 07:36 in Lisbon
  const wed = (over: Record<string, unknown>) => ({ ...cls({ dayOfWeek: 3 }), recurrence: 'weekly' as const, ...over });

  it('picks the earliest class of the academy day whose check-in has not opened yet', () => {
    const classes = [
      wed({ id: 'late', startTime: '19:00', endTime: '20:00' }),
      wed({ id: 'soon', startTime: '08:50', endTime: '10:00' }),
      wed({ id: 'gone', startTime: '06:00', endTime: '06:30' }),
      { ...wed({ id: 'other-day' }), dayOfWeek: 4, startTime: '08:00' },
      { ...wed({ id: 'once' }), recurrence: 'once' as const, date: '2026-11-19', startTime: '08:00' },
    ];
    expect(nextClassToday(classes, 'Europe/Lisbon', at)?.id).toBe('soon');
  });

  it('is null when no class is left today', () => {
    expect(nextClassToday([wed({ startTime: '06:00', endTime: '06:30' })], 'Europe/Lisbon', at)).toBeNull();
  });
});

describe('academyNow', () => {
  it('turns the instant into a date whose clock fields read the academy wall clock', () => {
    const at = new Date('2026-11-18T07:36:00Z');
    const d = academyNow('Europe/Lisbon', at);
    expect([isoDate(d), d.getHours(), d.getMinutes()]).toEqual(['2026-11-18', 7, 36]);
    expect(academyNow('Asia/Tokyo', at).getHours()).toBe(16);
  });
});
