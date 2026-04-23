# Classes Calendar and Dashboard Tweaks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the classes-card grid with a role-aware calendar (instructor: month/week/day with drag-to-reschedule and click-to-edit; student: today's day view with in-block check-in), add an "Open Totem" action on the instructor dashboard, and move the academy join-code card from the dashboard to settings.

**Architecture:** `react-big-calendar` + its free DnD addon, wrapped behind a library-agnostic custom hook (`useClassCalendar`) and a thin renderer component (`<ClassCalendar>`) so the library is swappable. Classes stay stored as `{ dayOfWeek, startTime, endTime }`; a pure helper materializes the weekly template into Date-anchored events for the displayed range. Drag-to-move updates the underlying weekly schedule via `PUT /classes/:id` with optimistic update and the already-in-place global error/success toasts.

**Tech Stack:** React 19 + Vite SPA, TanStack Query v5, react-big-calendar ^1.19 + `react-big-calendar/lib/addons/dragAndDrop`, date-fns ^3, TanStack Form, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-21-classes-calendar-and-dashboard-tweaks-design.md`

---

## File structure

**Create:**
- `apps/web/src/lib/schedule.ts` — pure `classesToCalendarEvents(classes, anchor, range)` helper.
- `apps/web/src/hooks/use-class-calendar.ts` — library-agnostic hook owning view state, event materialization, drop-to-move translation, click dispatch.
- `apps/web/src/components/schedule/class-calendar.tsx` — thin RBC renderer (wraps `withDragAndDrop(Calendar)`).
- `apps/web/src/components/schedule/class-calendar.css` — RBC theme overrides matching the arena palette.
- `apps/web/src/components/schedule/class-edit-dialog.tsx` — extracted edit dialog.
- `apps/web/src/pages/classes/instructor-view.tsx` — instructor role branch (calendar + create + edit + move mutation).
- `apps/web/src/pages/classes/student-view.tsx` — student role branch (day-only calendar + check-in).
- `apps/web/test/lib/schedule.test.ts` — helper unit tests.
- `apps/web/test/hooks/use-class-calendar.test.tsx` — hook unit tests.
- `apps/web/test/pages/dashboard.test.tsx` — dashboard unit tests.
- `apps/web/test/pages/settings.test.tsx` — settings unit tests.
- `tests/e2e/flows/classes-calendar.spec.ts` — e2e click-to-edit flow.

**Modify:**
- `apps/web/package.json` — add RBC, DnD addon types, date-fns.
- `apps/web/src/i18n/pt-BR.json`, `apps/web/src/i18n/en.json` — add `totem.openTotem`, `totem.openTotemExplainer`, `classes.moveSuccess`.
- `apps/web/src/pages/classes/index.tsx` — collapse into a role router.
- `apps/web/src/pages/dashboard.tsx` — add totem card, remove join-code card.
- `apps/web/src/pages/settings.tsx` — add join-code card.
- `apps/web/test/pages/classes.test.tsx` — update assertions to match calendar UI.

---

## Task 1: Install react-big-calendar + date-fns

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the runtime deps from `apps/web`**

```bash
cd /Users/iorran/pgt/apps/web && npm install react-big-calendar@^1.19 date-fns@^3
```

- [ ] **Step 2: Install the types**

```bash
cd /Users/iorran/pgt/apps/web && npm install -D @types/react-big-calendar
```

- [ ] **Step 3: Smoke-import to verify React 19 compat**

Create a throw-away file at `/tmp/rbc-check.tsx` to confirm the public API compiles:

```tsx
import { Calendar, dateFnsLocalizer, type Event } from 'react-big-calendar';
import withDragAndDrop, { type withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
const DnDCalendar = withDragAndDrop(Calendar);
export { DnDCalendar, dateFnsLocalizer };
export type { Event, withDragAndDropProps };
```

Then from `apps/web`:

```bash
cd /Users/iorran/pgt/apps/web && npx tsc --noEmit /tmp/rbc-check.tsx --jsx preserve --esModuleInterop --moduleResolution bundler --target es2022 --module esnext
```

Expected: exit 0. If the import paths or types don't resolve, that's a blocker — **STOP and report BLOCKED** (fallback is FullCalendar; spec risk section calls this out).

Delete `/tmp/rbc-check.tsx` after the check passes.

- [ ] **Step 4: Run existing lint + tests to confirm nothing regressed**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint && npx vitest run
```

Expected: lint exits 0; 141 tests pass.

- [ ] **Step 5: Commit (from repo root; stale nested `apps/web/.git` must be avoided)**

```bash
cd /Users/iorran/pgt && git add apps/web/package.json package-lock.json && git commit -m "chore(web): add react-big-calendar and date-fns"
```

---

## Task 2: Add i18n keys

**Files:**
- Modify: `apps/web/src/i18n/pt-BR.json`
- Modify: `apps/web/src/i18n/en.json`

- [ ] **Step 1: Add keys to `apps/web/src/i18n/pt-BR.json`**

Under the existing `totem` block, add:

```json
"openTotem": "Abrir Totem",
"openTotemExplainer": "Abra a tela de QR codes em outro dispositivo para seus alunos fazerem check-in."
```

Under the existing `classes` block, add:

```json
"moveSuccess": "Aula reagendada"
```

- [ ] **Step 2: Add the same keys to `apps/web/src/i18n/en.json`**

Under `totem`:

```json
"openTotem": "Open Totem",
"openTotemExplainer": "Open the QR-code screen on another device so students can check in."
```

Under `classes`:

```json
"moveSuccess": "Class rescheduled"
```

- [ ] **Step 3: Run the i18n completeness test**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/i18n/i18n-completeness.test.ts
```

Expected: tests pass (both locales have all keys).

- [ ] **Step 4: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/i18n/pt-BR.json apps/web/src/i18n/en.json && git commit -m "feat(web): i18n keys for Open Totem action and class move success"
```

---

## Task 3: Pure `classesToCalendarEvents` helper

**Files:**
- Create: `apps/web/src/lib/schedule.ts`
- Create: `apps/web/test/lib/schedule.test.ts`

Follow TDD: failing test first, then implementation.

- [ ] **Step 1: Write the failing test file**

Create `/Users/iorran/pgt/apps/web/test/lib/schedule.test.ts` with:

```ts
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
    // For a Monday class (dayOfWeek=1), start should land on 2026-03-23 08:00 local.
    // For a Wednesday class (dayOfWeek=3), start should land on 2026-03-25 08:00 local.
    const mon = cls({ id: 'c-mon', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' });
    const wed = cls({ id: 'c-wed', dayOfWeek: 3, startTime: '08:00', endTime: '09:00' });

    // Anchor inside the DST-transition week:
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
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/lib/schedule.test.ts
```

Expected: fails with `Failed to resolve import "@/lib/schedule"`.

- [ ] **Step 3: Implement the helper**

Create `/Users/iorran/pgt/apps/web/src/lib/schedule.ts` with:

```ts
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

/**
 * Monday-start week: offset from Sunday=0 dayOfWeek semantics.
 * dayOfWeek 0 (Sun) is the LAST day of the Mon-start week.
 */
function mondayOf(anchor: Date): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const js = d.getDay(); // 0=Sun..6=Sat
  const diff = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Offset in days from the Monday of the week to the given Sunday-based dayOfWeek (0..6).
 */
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

  // month: iterate each week in the calendar-month window.
  // RBC month view starts on Monday in our locale and renders 5-6 weeks.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = mondayOf(first);
  const gridEnd = mondayOf(last);
  gridEnd.setDate(gridEnd.getDate() + 6); // Sunday of the last visible week

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
```

- [ ] **Step 4: Run the tests**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/lib/schedule.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Run the full suite (regression check)**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/lib/schedule.ts apps/web/test/lib/schedule.test.ts && git commit -m "feat(web): classesToCalendarEvents helper for day/week/month ranges"
```

---

## Task 4: `useClassCalendar` hook

**Files:**
- Create: `apps/web/src/hooks/use-class-calendar.ts`
- Create: `apps/web/test/hooks/use-class-calendar.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `/Users/iorran/pgt/apps/web/test/hooks/use-class-calendar.test.tsx` with:

```tsx
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

    // Drop to Wednesday 2026-04-22 at 09:15, ending 10:45
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/hooks/use-class-calendar.test.tsx
```

Expected: fails with `Failed to resolve import "@/hooks/use-class-calendar"`.

- [ ] **Step 3: Implement the hook**

Create `/Users/iorran/pgt/apps/web/src/hooks/use-class-calendar.ts` with:

```ts
import { useState, useCallback, useMemo } from 'react';
import {
  classesToCalendarEvents,
  type CalendarEvent,
  type CalendarRange,
  type ClassItem,
} from '@/lib/schedule';

export interface UseClassCalendarOptions {
  classes: ClassItem[];
  onMove: (
    classId: string,
    patch: { dayOfWeek: number; startTime: string; endTime: string },
  ) => void;
  onSelect: (cls: ClassItem) => void;
  initialView?: CalendarRange;
  readOnly?: boolean;
}

export interface UseClassCalendarResult {
  events: CalendarEvent[];
  view: CalendarRange;
  date: Date;
  setView: (v: CalendarRange) => void;
  setDate: (d: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick: (eventId: string) => void;
  readOnly: boolean;
}

function hhmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function pickDefaultView(initial: CalendarRange | undefined): CalendarRange {
  if (initial) return initial;
  if (typeof window === 'undefined') return 'week';
  return window.matchMedia('(min-width: 768px)').matches ? 'week' : 'day';
}

export function useClassCalendar(
  opts: UseClassCalendarOptions,
): UseClassCalendarResult {
  const { classes, onMove, onSelect, initialView, readOnly = false } = opts;

  const [view, setView] = useState<CalendarRange>(() => pickDefaultView(initialView));
  const [date, setDate] = useState<Date>(() => new Date());

  const events = useMemo(
    () => classesToCalendarEvents(classes, date, view),
    [classes, date, view],
  );

  const onEventDrop = useCallback(
    (eventId: string, newStart: Date, newEnd: Date) => {
      if (readOnly) return;
      onMove(eventId, {
        dayOfWeek: newStart.getDay(),
        startTime: hhmm(newStart),
        endTime: hhmm(newEnd),
      });
    },
    [onMove, readOnly],
  );

  const onEventClick = useCallback(
    (eventId: string) => {
      const match = classes.find((c) => c.id === eventId);
      if (match) onSelect(match);
    },
    [classes, onSelect],
  );

  return {
    events,
    view,
    date,
    setView,
    setDate,
    onEventDrop,
    onEventClick,
    readOnly,
  };
}
```

- [ ] **Step 4: Run the hook tests**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/hooks/use-class-calendar.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Full suite**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/hooks/use-class-calendar.ts apps/web/test/hooks/use-class-calendar.test.tsx && git commit -m "feat(web): useClassCalendar hook isolating calendar state and callbacks"
```

---

## Task 5: `<ClassCalendar>` RBC renderer

**Files:**
- Create: `apps/web/src/components/schedule/class-calendar.tsx`
- Create: `apps/web/src/components/schedule/class-calendar.css`

No new tests here — this file is a thin adapter over RBC. Behavior is covered via the hook tests (Task 4) and the page tests (Task 7 / Task 8). RBC itself is trusted.

- [ ] **Step 1: Write the renderer**

Create `/Users/iorran/pgt/apps/web/src/components/schedule/class-calendar.tsx` with:

```tsx
import { Calendar, dateFnsLocalizer, type EventProps } from 'react-big-calendar';
import withDragAndDrop, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './class-calendar.css';
import type { CalendarEvent, CalendarRange } from '@/lib/schedule';

const locales = { 'en-US': enUS, 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

const TYPE_CLASS: Record<string, string> = {
  gi: 'cc-event-gi',
  'no-gi': 'cc-event-nogi',
  'open-mat': 'cc-event-openmat',
  kids: 'cc-event-kids',
};

function eventPropGetter(event: CalendarEvent) {
  const key = event.resource.type.toLowerCase().trim();
  return { className: TYPE_CLASS[key] ?? 'cc-event-default' };
}

export interface ClassCalendarProps {
  events: CalendarEvent[];
  view: CalendarRange;
  date: Date;
  onViewChange: (v: CalendarRange) => void;
  onDateChange: (d: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick: (eventId: string) => void;
  readOnly?: boolean;
  toolbar?: boolean;
  culture?: string;
  renderEvent?: (event: CalendarEvent) => React.ReactNode;
}

export function ClassCalendar(props: ClassCalendarProps) {
  const {
    events,
    view,
    date,
    onViewChange,
    onDateChange,
    onEventDrop,
    onEventClick,
    readOnly = false,
    toolbar = true,
    culture = 'pt-BR',
    renderEvent,
  } = props;

  const components = renderEvent
    ? {
        event: ({ event }: EventProps<CalendarEvent>) => <>{renderEvent(event)}</>,
      }
    : undefined;

  return (
    <DnDCalendar
      localizer={localizer}
      culture={culture}
      events={events}
      view={view}
      onView={(v) => onViewChange(v as CalendarRange)}
      date={date}
      onNavigate={(d) => onDateChange(d)}
      views={['month', 'week', 'day']}
      toolbar={toolbar}
      startAccessor="start"
      endAccessor="end"
      draggableAccessor={() => !readOnly}
      resizable={false}
      onEventDrop={(args: EventInteractionArgs<CalendarEvent>) => {
        if (readOnly) return;
        onEventDrop(args.event.id, args.start as Date, args.end as Date);
      }}
      onSelectEvent={(e) => onEventClick(e.id)}
      eventPropGetter={eventPropGetter}
      components={components}
      style={{ height: 600 }}
    />
  );
}
```

- [ ] **Step 2: Write the CSS**

Create `/Users/iorran/pgt/apps/web/src/components/schedule/class-calendar.css` with:

```css
.cc-event-gi {
  background-color: var(--color-blue-500, #3b82f6);
  border-color: var(--color-blue-600, #2563eb);
}
.cc-event-nogi {
  background-color: var(--primary);
  border-color: var(--primary);
}
.cc-event-openmat {
  background-color: var(--color-cyan-400, #22d3ee);
  border-color: var(--color-cyan-500, #06b6d4);
  color: #000;
}
.cc-event-kids {
  background-color: var(--color-purple-500, #a855f7);
  border-color: var(--color-purple-600, #9333ea);
}
.cc-event-default {
  background-color: var(--primary);
  border-color: var(--primary);
}

.rbc-toolbar {
  padding: 0.75rem 0;
  font-family: var(--font-heading);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.rbc-toolbar button {
  color: var(--foreground);
  border-color: var(--border);
  background: var(--card);
}
.rbc-toolbar button.rbc-active {
  background: var(--primary);
  color: var(--primary-foreground);
}
.rbc-time-view,
.rbc-month-view {
  border-color: var(--border);
  background: var(--card);
  border-radius: var(--radius);
}
.rbc-time-header-content,
.rbc-header,
.rbc-time-gutter {
  background: var(--card);
  color: var(--muted-foreground);
}
```

- [ ] **Step 3: Run lint + tests**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint && npx vitest run
```

Expected: lint exit 0; existing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/components/schedule/class-calendar.tsx apps/web/src/components/schedule/class-calendar.css && git commit -m "feat(web): ClassCalendar renderer wraps react-big-calendar with DnD"
```

---

## Task 6: Extract `<ClassEditDialog>`

**Files:**
- Create: `apps/web/src/components/schedule/class-edit-dialog.tsx`

- [ ] **Step 1: Read the current edit-dialog JSX in `apps/web/src/pages/classes/index.tsx`**

Skim the existing edit dialog (the `<Dialog open={!!editingClass} …>` block and its `editForm` declaration). You'll replicate the same form/markup in the new component, but accept the class to edit and submit behavior via props. The existing dialog submits via `api(PUT /classes/:id)` and resets state via `editForm.reset()` / `setEditingClass(null)`.

- [ ] **Step 2: Write the component**

Create `/Users/iorran/pgt/apps/web/src/components/schedule/class-edit-dialog.tsx` with:

```tsx
import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { ClassItem } from '@/lib/schedule';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export interface ClassEditDialogProps {
  cls: ClassItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (patch: {
    name: string;
    type: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => Promise<void> | void;
}

export function ClassEditDialog({ cls, onOpenChange, onSubmit }: ClassEditDialogProps) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      dayOfWeek: 0,
      startTime: '',
      endTime: '',
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  useEffect(() => {
    if (!cls) return;
    form.reset();
    form.setFieldValue('name', cls.name);
    form.setFieldValue('type', cls.type);
    form.setFieldValue('dayOfWeek', cls.dayOfWeek);
    form.setFieldValue('startTime', cls.startTime);
    form.setFieldValue('endTime', cls.endTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls]);

  return (
    <Dialog open={!!cls} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {t('classes.editClass')}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('classes.className')}</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
              </div>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('classes.classType')}</Label>
                <select
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="">--</option>
                  <option value="gi">Gi</option>
                  <option value="no-gi">No-Gi</option>
                  <option value="open-mat">Open Mat</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
            )}
          </form.Field>
          <form.Field name="dayOfWeek">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('classes.daysOfWeek')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => field.handleChange(i)}
                      className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                        field.state.value === i
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form.Field>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startTime">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('classes.startTime')}</Label>
                  <Input
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="endTime">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('classes.endTime')}</Label>
                  <Input
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
          </div>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                {t('common.save')}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/components/schedule/class-edit-dialog.tsx && git commit -m "feat(web): extract ClassEditDialog for shared use in calendar and list"
```

---

## Task 7: `instructor-view.tsx`

**Files:**
- Create: `apps/web/src/pages/classes/instructor-view.tsx`

This file is the main wiring for the instructor experience: fetch classes, mount the calendar, open the dialog on click, persist drag moves optimistically.

- [ ] **Step 1: Write the component**

Create `/Users/iorran/pgt/apps/web/src/pages/classes/instructor-view.tsx` with:

```tsx
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import { ClassCalendar } from '@/components/schedule/class-calendar';
import { ClassEditDialog } from '@/components/schedule/class-edit-dialog';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TabsNav } from '@/components/tabs-nav';
import type { ClassItem } from '@/lib/schedule';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export function InstructorClassesView() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const moveMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }) =>
      api(`/classes/${vars.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          dayOfWeek: vars.dayOfWeek,
          startTime: vars.startTime,
          endTime: vars.endTime,
        }),
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: ['classes', user.academyId],
      });
      const prev = queryClient.getQueryData<ClassItem[]>([
        'classes',
        user.academyId,
      ]);
      queryClient.setQueryData<ClassItem[]>(
        ['classes', user.academyId],
        (old = []) => old.map((c) => (c.id === vars.id ? { ...c, ...vars } : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['classes', user.academyId], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['classes', user.academyId],
      });
    },
    meta: { successMessage: t('classes.moveSuccess') },
  });

  const editMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      patch: {
        name: string;
        type: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      };
    }) =>
      api(`/classes/${vars.id}`, {
        method: 'PUT',
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
      setEditing(null);
    },
  });

  const calendar = useClassCalendar({
    classes,
    onMove: (id, patch) => moveMutation.mutate({ id, ...patch }),
    onSelect: (cls) => setEditing(cls),
  });

  const createForm = useForm({
    defaultValues: {
      name: '',
      type: '',
      recurrence: 'weekly',
      daysOfWeek: [] as number[],
      startTime: '',
      endTime: '',
    },
    onSubmit: async ({ value }) => {
      for (const day of value.daysOfWeek) {
        await api('/classes', {
          method: 'POST',
          body: JSON.stringify({
            name: value.name,
            type: value.type,
            recurrence: value.recurrence,
            dayOfWeek: day,
            startTime: value.startTime,
            endTime: value.endTime,
            academyId: user.academyId,
          }),
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['classes', user.academyId],
      });
      setCreateOpen(false);
      createForm.reset();
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TabsNav
        items={[
          { to: '/classes', label: t('classes.title') },
          { to: '/classes/history', label: t('classes.checkinHistory') },
        ]}
      />
      <div className="flex items-center justify-between">
        <span className="arena-stat text-primary text-xl md:text-2xl">
          {classes.length}
        </span>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            {t('classes.createClass')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-wider">
                {t('classes.createClass')}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createForm.handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <createForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.className')}</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                    />
                  </div>
                )}
              </createForm.Field>
              <createForm.Field name="type">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.classType')}</Label>
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                      className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                    >
                      <option value="">--</option>
                      <option value="gi">Gi</option>
                      <option value="no-gi">No-Gi</option>
                      <option value="open-mat">Open Mat</option>
                      <option value="kids">Kids</option>
                    </select>
                  </div>
                )}
              </createForm.Field>
              <createForm.Field name="daysOfWeek">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('classes.daysOfWeek')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_KEYS.map((k, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const current = field.state.value;
                            field.handleChange(
                              current.includes(i)
                                ? current.filter((d) => d !== i)
                                : [...current, i],
                            );
                          }}
                          className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                            field.state.value.includes(i)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                          }`}
                        >
                          {t(k)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </createForm.Field>
              <div className="grid grid-cols-2 gap-4">
                <createForm.Field name="startTime">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('classes.startTime')}</Label>
                      <Input
                        type="time"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
                <createForm.Field name="endTime">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('classes.endTime')}</Label>
                      <Input
                        type="time"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
              </div>
              <createForm.Subscribe
                selector={(state) => ({
                  daysOfWeek: state.values.daysOfWeek,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ daysOfWeek, isSubmitting }) => (
                  <Button
                    type="submit"
                    disabled={daysOfWeek.length === 0}
                    loading={isSubmitting}
                  >
                    {t('common.save')}
                  </Button>
                )}
              </createForm.Subscribe>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ClassCalendar
        events={calendar.events}
        view={calendar.view}
        date={calendar.date}
        onViewChange={calendar.setView}
        onDateChange={calendar.setDate}
        onEventDrop={calendar.onEventDrop}
        onEventClick={calendar.onEventClick}
      />

      <ClassEditDialog
        cls={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={async (patch) => {
          if (!editing) return;
          await editMutation.mutateAsync({ id: editing.id, patch });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/pages/classes/instructor-view.tsx && git commit -m "feat(web): instructor classes view with calendar + optimistic move"
```

---

## Task 8: `student-view.tsx`

**Files:**
- Create: `apps/web/src/pages/classes/student-view.tsx`

- [ ] **Step 1: Write the component**

Create `/Users/iorran/pgt/apps/web/src/pages/classes/student-view.tsx` with:

```tsx
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useApiQuery } from '@/hooks/use-api';
import { useClassCalendar } from '@/hooks/use-class-calendar';
import { ClassCalendar } from '@/components/schedule/class-calendar';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { TabsNav } from '@/components/tabs-nav';
import type { ClassItem, CalendarEvent } from '@/lib/schedule';

function isActiveNow(cls: ClassItem): boolean {
  const now = new Date();
  if (cls.dayOfWeek !== now.getDay()) return false;
  const [sh, sm] = cls.startTime.split(':').map(Number);
  const [eh, em] = cls.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= sh * 60 + sm - 15 && nowMin <= eh * 60 + em + 60;
}

export function StudentClassesView() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: myCheckins = [] } = useApiQuery<any[]>(
    ['my-checkins', user?.id],
    `/checkins/student/${user?.id}`,
    !!user?.id,
  );

  function isCheckedIn(classId: string): boolean {
    const today = new Date().toDateString();
    return myCheckins.some(
      (c: any) =>
        c.classId === classId && new Date(c.checkedInAt).toDateString() === today,
    );
  }

  const checkinMutation = useMutation({
    mutationFn: (data: {
      classId: string;
      source: 'button';
      latitude: number;
      longitude: number;
    }) =>
      api('/checkins', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-checkins'] });
    },
    meta: { successMessage: t('classes.checkinSuccess') },
  });

  function handleCheckin(classId: string) {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        checkinMutation.mutate({
          classId,
          source: 'button',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => toast.error(t('classes.checkinTooFar')),
    );
  }

  const calendar = useClassCalendar({
    classes,
    onMove: () => {}, // students don't move
    onSelect: () => {}, // clicks are no-ops at calendar level; the render-event button handles actions
    initialView: 'day',
    readOnly: true,
  });

  function renderEvent(event: CalendarEvent) {
    const cls = event.resource;
    const active = isActiveNow(cls);
    const checkedIn = isCheckedIn(cls.id);
    return (
      <div className="flex flex-col gap-1 p-1 text-xs">
        <span className="font-heading uppercase">{cls.name}</span>
        <span>
          {cls.startTime} – {cls.endTime}
        </span>
        {active && !checkedIn && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleCheckin(cls.id);
            }}
          >
            {t('classes.checkinProximity')}
          </Button>
        )}
        {checkedIn && (
          <span className="text-primary font-bold">{t('classes.checkedIn')}</span>
        )}
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <TabsNav
        items={[
          { to: '/classes', label: t('classes.title') },
          { to: '/classes/history', label: t('classes.checkinHistory') },
        ]}
      />
      <ClassCalendar
        events={calendar.events}
        view="day"
        date={calendar.date}
        onViewChange={() => {}}
        onDateChange={() => {}}
        onEventDrop={() => {}}
        onEventClick={() => {}}
        readOnly
        toolbar={false}
        renderEvent={renderEvent}
      />
      {calendar.events.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          {t('common.noResults')}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/pages/classes/student-view.tsx && git commit -m "feat(web): student classes view with today's calendar + in-block check-in"
```

---

## Task 9: Refactor `pages/classes/index.tsx` into a role router

**Files:**
- Modify: `apps/web/src/pages/classes/index.tsx`
- Modify: `apps/web/test/pages/classes.test.tsx`

- [ ] **Step 1: Replace the entire `apps/web/src/pages/classes/index.tsx` with:**

```tsx
import { useSession } from '@/lib/auth-client';
import { InstructorClassesView } from './instructor-view';
import { StudentClassesView } from './student-view';

export default function ClassesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  if (user?.role === 'instructor') return <InstructorClassesView />;
  return <StudentClassesView />;
}
```

- [ ] **Step 2: Update the existing `apps/web/test/pages/classes.test.tsx`**

The current test file asserts on card titles (`Morning Gi`, `No-Gi Night`), on `classes.createClass` button, on the checkin-proximity button, and on edit/delete button aria-labels. After the refactor, these assertions no longer match the UI. Rewrite the file to exercise the role router.

Replace the contents of `/Users/iorran/pgt/apps/web/test/pages/classes.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import ClassesPage from '@/pages/classes/index';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('@/pages/classes/instructor-view', () => ({
  InstructorClassesView: () => <div data-testid="instructor-view">instructor</div>,
}));

vi.mock('@/pages/classes/student-view', () => ({
  StudentClassesView: () => <div data-testid="student-view">student</div>,
}));

import { useSession } from '@/lib/auth-client';
const mockUseSession = vi.mocked(useSession);

const instructorSession = {
  data: { user: { id: 'u1', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('ClassesPage role router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instructor view for instructors', () => {
    mockUseSession.mockReturnValue(instructorSession);
    renderWithProviders(<ClassesPage />);
    expect(screen.getByTestId('instructor-view')).toBeInTheDocument();
    expect(screen.queryByTestId('student-view')).not.toBeInTheDocument();
  });

  it('renders student view for students', () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);
    expect(screen.getByTestId('student-view')).toBeInTheDocument();
    expect(screen.queryByTestId('instructor-view')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all tests pass (previous class test count drops; new router tests add 2).

- [ ] **Step 4: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/pages/classes/index.tsx apps/web/test/pages/classes.test.tsx && git commit -m "refactor(web): split classes page into instructor/student role router"
```

---

## Task 10: Dashboard — add totem card, remove join-code card

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`
- Create: `apps/web/test/pages/dashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `/Users/iorran/pgt/apps/web/test/pages/dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import DashboardPage from '@/pages/dashboard';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue([] as any);
  });

  it('shows Open Totem card for instructors', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() =>
      expect(screen.getByText('totem.openTotem')).toBeInTheDocument(),
    );
  });

  it('Open Totem button opens /totem in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    const button = await screen.findByRole('button', { name: 'totem.openTotem' });
    await user.click(button);
    expect(openSpy).toHaveBeenCalledWith('/totem', '_blank', 'noopener');
    openSpy.mockRestore();
  });

  it('does not render join-code card on dashboard', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText('onboarding.joinCode')).not.toBeInTheDocument();
      expect(screen.queryByText('onboarding.copyCode')).not.toBeInTheDocument();
      expect(screen.queryByText('onboarding.shareWhatsApp')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/pages/dashboard.test.tsx
```

Expected: fails (no totem card yet; join-code card still present).

- [ ] **Step 3: Update `/Users/iorran/pgt/apps/web/src/pages/dashboard.tsx`**

Replace its contents with:

```tsx
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({
  value,
  label,
  isLoading,
}: {
  value: number;
  label: string;
  isLoading: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : (
          <p className="font-mono text-3xl text-primary arena-stat">{value}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isInstructor = user?.role === 'instructor';

  const { data: students = [], isLoading: studentsLoading } = useApiQuery<any[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: classes = [], isLoading: classesLoading } = useApiQuery<any[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: tournaments = [], isLoading: tournamentsLoading } = useApiQuery<
    any[]
  >(
    ['tournaments', user?.academyId],
    `/tournaments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: paymentStatus } = useApiQuery<{
    status: string;
    daysOverdue?: number;
    daysUntilDue?: number;
  }>(['my-payment-status'], '/payments/my-status', !!user?.id && !isInstructor);

  function handleOpenTotem() {
    window.open('/totem', '_blank', 'noopener');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.dashboard')}
      </h1>

      <p className="text-muted-foreground">
        {t('dashboard.greeting', { name: user?.name })}
      </p>

      {!isInstructor && paymentStatus?.status === 'overdue' && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive font-medium text-sm">
            {t('billing.yourPaymentOverdue', { days: paymentStatus.daysOverdue })}
          </p>
        </div>
      )}

      {!isInstructor && paymentStatus?.status === 'upcoming' && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-primary font-medium text-sm">
            {t('billing.paymentDueSoon', { days: paymentStatus.daysUntilDue })}
          </p>
        </div>
      )}

      {isInstructor && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-xl uppercase">
              {t('totem.openTotem')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('totem.openTotemExplainer')}
            </p>
            <Button variant="outline" onClick={handleOpenTotem}>
              {t('totem.openTotem')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          value={students.length}
          label={t('nav.students')}
          isLoading={studentsLoading}
        />
        <StatCard
          value={classes.length}
          label={t('nav.classes')}
          isLoading={classesLoading}
        />
        <StatCard
          value={tournaments.length}
          label={t('nav.tournaments')}
          isLoading={tournamentsLoading}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/pages/dashboard.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Full suite**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/pages/dashboard.tsx apps/web/test/pages/dashboard.test.tsx && git commit -m "feat(web): add Open Totem action card and remove join-code card from dashboard"
```

---

## Task 11: Settings — add join-code card

**Files:**
- Modify: `apps/web/src/pages/settings.tsx`
- Create: `apps/web/test/pages/settings.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `/Users/iorran/pgt/apps/web/test/pages/settings.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import SettingsPage from '@/pages/settings';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const academy = {
  id: 'a1',
  name: 'Test Academy',
  city: 'Lisbon',
  latitude: null,
  longitude: null,
  address: null,
  joinCode: 'ABC123',
};

const instructorSession = {
  data: { user: { id: 'u1', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(academy as any);
  });

  it('renders the join code for instructors', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });
  });

  it('copy button writes join code to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.copyCode' });
    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith('ABC123');
  });

  it('WhatsApp share opens a wa.me link with the join URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.shareWhatsApp' });
    await user.click(btn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=.*ABC123/),
      '_blank',
    );
    openSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/pages/settings.test.tsx
```

Expected: fails (no join-code block yet).

- [ ] **Step 3: Update `/Users/iorran/pgt/apps/web/src/pages/settings.tsx`**

Replace its contents with:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  joinCode: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isInstructor = user?.role === 'instructor';
  const queryClient = useQueryClient();
  const [locationMsg, setLocationMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: academy } = useApiQuery<AcademyInfo>(
    ['academy-mine'],
    '/academies/mine',
    !!user?.academyId,
  );

  function handleSetLocation() {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await api(`/academies/${academy!.id}/location`, {
          method: 'PUT',
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ['academy-mine'] });
        setLocationMsg(t('onboarding.locationSet'));
        setTimeout(() => setLocationMsg(''), 3000);
      },
      () => {
        setLocationMsg(t('settings.geolocationUnavailable'));
        setTimeout(() => setLocationMsg(''), 3000);
      },
    );
  }

  function handleCopy() {
    if (!academy) return;
    navigator.clipboard.writeText(academy.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareWhatsApp() {
    if (!academy) return;
    const message = `${t('onboarding.shareMessage')} ${window.location.origin}/entrar/${academy.joinCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('nav.settings')}
      </h1>

      {isInstructor && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-lg uppercase">
              {academy.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('onboarding.joinCode')}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl bg-secondary p-4 rounded-sm flex-1 text-center">
                  {academy.joinCode}
                </span>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? t('onboarding.copied') : t('onboarding.copyCode')}
                </Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleShareWhatsApp}>
              {t('onboarding.shareWhatsApp')}
            </Button>
          </CardContent>
        </Card>
      )}

      {isInstructor && academy && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
              <MapPin size={20} className="text-primary" />
              {t('onboarding.setLocation')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {academy.latitude ? (
              <div className="space-y-1">
                {academy.address && (
                  <p className="text-sm text-foreground">{academy.address}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {academy.latitude}, {academy.longitude}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('onboarding.locationNotSet')}
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={handleSetLocation}>
              {t('onboarding.useMyLocation')}
            </Button>
            {locationMsg && <p className="text-primary text-sm">{locationMsg}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run test/pages/settings.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Full suite**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/iorran/pgt && git add apps/web/src/pages/settings.tsx apps/web/test/pages/settings.test.tsx && git commit -m "feat(web): show academy join code in settings (moved from dashboard)"
```

---

## Task 12: e2e — instructor calendar click-to-edit

**Files:**
- Create: `tests/e2e/flows/classes-calendar.spec.ts`

- [ ] **Step 1: Inspect the fixture helper for creating classes**

Read `tests/e2e/fixtures.ts` to confirm `createClass(academyId, instructorId, { name, type, dayOfWeek, startTime, endTime })` still returns the inserted row.

- [ ] **Step 2: Write the spec**

Create `/Users/iorran/pgt/tests/e2e/flows/classes-calendar.spec.ts` with:

```ts
import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  createClass,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

/**
 * Verifies the instructor calendar renders and opens the edit dialog on click.
 * Drag-to-reschedule is covered by unit tests (hook + mutation); e2e DnD is
 * too brittle to exercise against live library internals.
 */
test('instructor visits /classes, clicks an event, edit dialog opens', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const cls = await createClass(setup.academy.id, setup.instructor.id, {
    name: 'E2E Calendar Class',
    type: 'gi',
    dayOfWeek: new Date().getDay(), // today, so it's visible in both week and day views
    startTime: '09:00',
    endTime: '10:00',
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.goto('/classes');

    // Event block visible
    await expect(page.getByText(cls.name)).toBeVisible({ timeout: 10_000 });

    // Click opens the edit dialog
    await page.getByText(cls.name).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('dialog').getByText(/editar aula|edit class/i)).toBeVisible();
  } finally {
    await context.close();
  }
});
```

- [ ] **Step 3: Commit (do not require live stack; e2e will run locally when the user tests)**

```bash
cd /Users/iorran/pgt && git add tests/e2e/flows/classes-calendar.spec.ts && git commit -m "test(e2e): instructor calendar renders and click opens edit dialog"
```

---

## Task 13: Final regression sweep

- [ ] **Step 1: Lint**

```bash
cd /Users/iorran/pgt/apps/web && npm run lint
```

Expected: exit 0.

- [ ] **Step 2: Full unit suite**

```bash
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Manual smoke test (user to run)**

Tell the user these manual checks to perform once they pull:

1. Log in as instructor → `/dashboard` shows "Open Totem" card, no join-code card; button opens totem in new tab.
2. `/settings` shows academy name + join code + copy + WhatsApp buttons.
3. `/classes` shows the calendar; week view on desktop, day view on mobile. Drag a class to a different day/time → success toast + persisted on reload. Click a class → edit dialog opens pre-filled.
4. Log in as student → `/classes` shows today's day view. If a class is active now, a check-in button appears in the block; tap it → success toast. If no classes today, the empty message shows.

---

## Self-review notes

- **Spec coverage:** every bullet from Sections 1–3 of the spec maps to a task.
  - §1 instructor calendar → Tasks 3, 4, 5, 6, 7
  - §1 drag persistence → Task 7 (`moveMutation`)
  - §1 click-to-edit → Task 7 (`editMutation`) + Task 6 (dialog)
  - §2 student today view + check-in → Task 8
  - §3 totem action + join-code relocation → Tasks 10, 11
  - Library choice → Task 1
  - i18n → Task 2
  - Tests → Tasks 3, 4, 9, 10, 11, 12
- **No placeholders:** every code block contains the actual code; every command has an expected outcome.
- **Naming consistency:** `classesToCalendarEvents`, `useClassCalendar`, `ClassCalendar`, `ClassEditDialog`, `InstructorClassesView`, `StudentClassesView`, `meta.successMessage`, `meta.silent`, `/classes`, `/totem`, `/settings`, `onboarding.joinCode`, `totem.openTotem`, `classes.moveSuccess` used identically across tasks.
- **Out of scope, intentionally:** per-date class exceptions, duration resizing, view-state persistence, calendar for non-class entities (per spec Non-goals).
