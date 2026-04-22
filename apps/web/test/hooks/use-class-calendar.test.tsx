import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import type { ClassItem } from '@/lib/schedule';

const cls = (over: Partial<ClassItem> = {}): ClassItem => ({
  id: 'c1',
  name: 'Morning Gi',
  type: 'gi',
  dayOfWeek: 2,
  startTime: '07:00',
  endTime: '08:30',
  ...over,
});

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('useClassCalendar', () => {
  beforeEach(() => {
    stubMatchMedia(true); // default: wide viewport
  });

  it('defaults to week view on wide viewports', () => {
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove: vi.fn(), onSelect: vi.fn() }),
    );
    expect(result.current.view).toBe('week');
  });

  it('defaults to day view on narrow viewports', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove: vi.fn(), onSelect: vi.fn() }),
    );
    expect(result.current.view).toBe('day');
  });

  it('materializes events for the current view + date', () => {
    const { result } = renderHook(() =>
      useClassCalendar({
        classes: [cls()],
        onMove: vi.fn(),
        onSelect: vi.fn(),
      }),
    );
    expect(result.current.events.length).toBeGreaterThan(0);
    expect(result.current.events[0].title).toBe('Morning Gi');
  });

  it('onEventDrop translates a new start/end into dayOfWeek + HH:mm and calls onMove', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove, onSelect: vi.fn() }),
    );

    const newStart = new Date(2026, 3, 22, 9, 15);
    const newEnd = new Date(2026, 3, 22, 10, 45);

    act(() => {
      result.current.onEventDrop('c1', newStart, newEnd);
    });

    expect(onMove).toHaveBeenCalledWith('c1', {
      dayOfWeek: 3,
      startTime: '09:15',
      endTime: '10:45',
    });
  });

  it('onEventClick looks up the class by id and calls onSelect', () => {
    const onSelect = vi.fn();
    const target = cls({ id: 'c2', name: 'Evening No-Gi' });
    const { result } = renderHook(() =>
      useClassCalendar({
        classes: [cls(), target],
        onMove: vi.fn(),
        onSelect,
      }),
    );

    act(() => {
      result.current.onEventClick('c2');
    });

    expect(onSelect).toHaveBeenCalledWith(target);
  });

  it('setView and setDate update state', () => {
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove: vi.fn(), onSelect: vi.fn() }),
    );
    act(() => {
      result.current.setView('month');
    });
    expect(result.current.view).toBe('month');

    const d = new Date(2026, 5, 1);
    act(() => {
      result.current.setDate(d);
    });
    expect(result.current.date.toISOString()).toBe(d.toISOString());
  });

  it('when readOnly is true, onEventDrop is a no-op', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useClassCalendar({
        classes: [cls()],
        onMove,
        onSelect: vi.fn(),
        readOnly: true,
      }),
    );
    act(() => {
      result.current.onEventDrop('c1', new Date(2026, 3, 22, 9, 0), new Date(2026, 3, 22, 10, 0));
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
