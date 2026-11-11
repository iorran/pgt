import { describe, it, expect, vi } from 'vitest';

vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));
vi.mock('react-big-calendar/lib/addons/dragAndDrop/styles.css', () => ({}));

import { eventPropGetter, isDraggable } from '@/components/schedule/class-calendar';
import type { CalendarEvent, ClassItem } from '@/lib/schedule';

function event(over: Partial<ClassItem>, minutes = 90): CalendarEvent {
  const start = new Date(2026, 10, 10, 19, 0);
  return {
    id: 'c',
    title: 'Fundamentos',
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    resource: { id: 'c', name: 'Fundamentos', type: 'gi', dayOfWeek: 2, startTime: '19:00', endTime: '20:30', ...over },
  };
}

describe('ClassCalendar events', () => {
  it('only weekly classes can be dragged', () => {
    expect(isDraggable(event({ recurrence: 'weekly' }))).toBe(true);
    expect(isDraggable(event({ recurrence: 'once', date: '2026-11-10' }))).toBe(false);
    expect(isDraggable(event({ recurrence: 'once', date: '2026-11-10', isSeminar: true }))).toBe(false);
  });

  it('marks seminars and short events for styling', () => {
    expect(eventPropGetter(event({ isSeminar: true, recurrence: 'once' })).className).toContain('cc-event-seminar');
    expect(eventPropGetter(event({}, 45)).className).toContain('cc-event-short');
    expect(eventPropGetter(event({})).className ?? '').toBe('');
  });
});
