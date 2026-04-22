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

// Live matchMedia stub: tracks the latest MediaQueryList so tests can flip
// `matches` and fire the `change` event to exercise the hook's resize path.
// Uses only addEventListener/removeEventListener (what the hook actually calls);
// the deprecated addListener/removeListener surface is intentionally omitted.
type MqlStub = MediaQueryList & { __fire: (next: boolean) => void };
let currentMql: MqlStub | undefined;

function stubMatchMedia(matches: boolean) {
  currentMql = undefined;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => {
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      const mql: MqlStub = {
        matches,
        media: q,
        onchange: null,
        addEventListener: (_type: string, cb: any) => listeners.add(cb),
        removeEventListener: (_type: string, cb: any) => listeners.delete(cb),
        dispatchEvent: () => true,
        __fire: (next: boolean) => {
          mql.matches = next;
          listeners.forEach((cb) =>
            cb({ matches: next, media: q } as MediaQueryListEvent),
          );
        },
      } as MqlStub;
      currentMql = mql;
      return mql;
    },
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

  it('onEventDrop preserves the class duration regardless of RBC newEnd', () => {
    const onMove = vi.fn();
    // Original class: 07:00 – 08:30 → 90-minute duration.
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove, onSelect: vi.fn() }),
    );

    const newStart = new Date(2026, 3, 22, 9, 15);
    // Pretend RBC suggests a shorter end (e.g. target slot truncated it).
    // The hook should IGNORE this and recompute from the original duration.
    const rbcTruncatedEnd = new Date(2026, 3, 22, 9, 45);

    act(() => {
      result.current.onEventDrop('c1', newStart, rbcTruncatedEnd);
    });

    expect(onMove).toHaveBeenCalledWith('c1', {
      dayOfWeek: 3,
      startTime: '09:15',
      endTime: '10:45', // 09:15 + 90 min, not RBC's 09:45
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

  it('switches to day view when the viewport crosses the breakpoint downward', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove: vi.fn(), onSelect: vi.fn() }),
    );
    expect(result.current.view).toBe('week');

    act(() => {
      currentMql!.__fire(false);
    });
    expect(result.current.view).toBe('day');
  });

  it('stops auto-switching once the user explicitly picks a view', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() =>
      useClassCalendar({ classes: [cls()], onMove: vi.fn(), onSelect: vi.fn() }),
    );

    act(() => {
      result.current.setView('month');
    });
    expect(result.current.view).toBe('month');

    act(() => {
      currentMql!.__fire(false);
    });
    // User's explicit choice should NOT be overridden by a resize
    expect(result.current.view).toBe('month');
  });

  it('does not attach a resize listener when initialView is pinned', () => {
    stubMatchMedia(true);
    renderHook(() =>
      useClassCalendar({
        classes: [cls()],
        onMove: vi.fn(),
        onSelect: vi.fn(),
        initialView: 'day',
      }),
    );
    // `currentMql` stays undefined when the hook skips the effect entirely:
    // the stub only records the MQL on `window.matchMedia(...)` calls, so if
    // it was never called, the hook never subscribed.
    expect(currentMql).toBeUndefined();
  });
});
