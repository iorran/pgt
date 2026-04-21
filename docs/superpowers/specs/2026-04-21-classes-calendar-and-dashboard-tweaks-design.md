# Design — Classes calendar view and instructor dashboard tweaks

**Date:** 2026-04-21
**Author:** Iorran Castro (with Claude)

## Motivation

Two pain points on the instructor experience:

1. The classes page renders every class as a card in a flat grid. Instructors cannot see the schedule by day at a glance — finding "what runs on Wednesday" requires scanning every card. A calendar grid (days on X, time on Y) matches how instructors think about their week.
2. The totem view (`/totem`) is important but has no entry point from the instructor panel — instructors must type the URL. Meanwhile the dashboard's most prominent card is the academy join code, which is consulted rarely.

We also want the student check-in flow to benefit from the same visual language: today's classes shown on a day-scale timeline, with the existing check-in action attached to the active block.

## Goals

- Instructors see a full calendar (month / week / day) on `/classes`, with drag-to-reschedule and click-to-edit.
- Students see a day-view calendar pinned to today on `/classes`, with the existing proximity check-in button anchored to the active class block.
- Instructors have a prominent "Open Totem" action on the dashboard; the academy join-code card moves to settings.
- The calendar library can be swapped later without touching consumers.

## Non-goals

- Per-date class exceptions (one-off cancellations, substitutions). Classes remain pure weekly templates.
- Duration resizing via calendar drag. Drag only moves whole blocks; duration is edited via the dialog.
- Persisting the user's last-used view or anchor date across sessions.
- Calendar for tournaments, payments, or any non-class entities.
- Bulk operations.

## Architecture

Three independent pieces:

1. **Calendar library and adapter layer.** `react-big-calendar` is the chosen library (its drag-and-drop addon is free; schedule-x's DnD plugin is behind a premium license). All library-specific code lives behind a custom hook (`useClassCalendar`) and a thin renderer component (`<ClassCalendar>`), so a future swap to `schedule-x`, `fullcalendar`, or `dnd-kit` + a custom grid touches only those two files.
2. **Classes page refactor.** `pages/classes/index.tsx` becomes a thin role-router mounting `instructor-view.tsx` or `student-view.tsx`. The edit dialog is extracted to `components/schedule/class-edit-dialog.tsx`.
3. **Dashboard tweaks.** Add a totem action card; move the join-code card to settings.

```
Components / hooks
        │
        ▼
 classes/index.tsx  (role router)
   ├─ instructor-view.tsx ──┐
   │                         └─▶ <ClassCalendar>  uses  useClassCalendar()  uses  lib/schedule.ts
   └─ student-view.tsx ─────┘                                (pure event materialization)
                              ↓
                  react-big-calendar + /addons/dragAndDrop  (adapter-isolated)
```

## Library choice

**Chosen: `react-big-calendar`** with the free `react-big-calendar/lib/addons/dragAndDrop` HOC and `date-fns` as the localizer.

Rationale:

| | react-big-calendar | schedule-x | FullCalendar |
|-|-|-|-|
| First release | 2014 | 2023 | 2011 |
| License | MIT | MIT (core) / paid DnD | MIT |
| DnD | free (`/addons/dragAndDrop`) | **paid (`@sx-premium/drag-and-drop`)** | free (`@fullcalendar/interaction`) |
| Views | month/week/day built-in | month/week/day built-in | month/week/day built-in |
| React 19 | confirmed | confirmed | confirmed |
| Bundle | medium | smaller | larger |
| Theming | CSS overrides, opinionated | design tokens | design tokens |

We initially picked schedule-x, but its DnD plugin is premium. RBC's free addon handles every requirement in this spec with no license cost, so RBC wins. FullCalendar is also viable but heavier.

The adapter layer (hook + renderer) ensures picking RBC is not a one-way door. If its theming friction becomes painful later, we can swap to schedule-x (paying for DnD) or a custom dnd-kit grid without touching any consumer.

## Section 1 — Instructor calendar

### Files

- Create: `apps/web/src/hooks/use-class-calendar.ts`
- Create: `apps/web/src/lib/schedule.ts` (pure `classesToCalendarEvents`)
- Create: `apps/web/src/components/schedule/class-calendar.tsx` (renderer; wraps `withDragAndDrop(Calendar)`)
- Create: `apps/web/src/components/schedule/class-edit-dialog.tsx` (extracted)
- Create: `apps/web/src/components/schedule/class-calendar.css` (RBC theme overrides)
- Create: `apps/web/src/pages/classes/instructor-view.tsx`
- Modify: `apps/web/src/pages/classes/index.tsx` (becomes a role router)

### Hook contract

```ts
export interface UseClassCalendarOptions {
  classes: ClassItem[];
  onMove: (classId: string, patch: Pick<ClassItem, 'dayOfWeek' | 'startTime' | 'endTime'>) => void;
  onSelect: (cls: ClassItem) => void;
  initialView?: 'month' | 'week' | 'day';
  readOnly?: boolean;
}

export interface UseClassCalendarResult {
  events: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  date: Date;
  setView: (v: 'month' | 'week' | 'day') => void;
  setDate: (d: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventClick: (eventId: string) => void;
  readOnly: boolean;
}
```

The hook:
- Defaults view to `week` on viewports ≥768px, `day` below (reads `window.matchMedia('(min-width: 768px)')` once in a lazy initializer).
- Memoizes `events` via `classesToCalendarEvents(classes, date, view)`.
- Translates `onEventDrop(id, start, end)` → `onMove(id, { dayOfWeek: start.getDay(), startTime: hhmm(start), endTime: hhmm(end) })`.
- Dispatches `onEventClick(id)` → `onSelect(cls)` by finding the matching class by id.

### Drag persistence

`instructor-view.tsx` holds a `useMutation` wired to `PUT /classes/:id` with optimistic update:

```ts
const moveMutation = useMutation({
  mutationFn: (vars: { id: string; dayOfWeek: number; startTime: string; endTime: string }) =>
    api(`/classes/${vars.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        dayOfWeek: vars.dayOfWeek,
        startTime: vars.startTime,
        endTime: vars.endTime,
      }),
    }),
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ['classes', user.academyId] });
    const prev = queryClient.getQueryData<ClassItem[]>(['classes', user.academyId]);
    queryClient.setQueryData<ClassItem[]>(['classes', user.academyId], (old = []) =>
      old.map((c) => (c.id === vars.id ? { ...c, ...vars } : c)),
    );
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(['classes', user.academyId], ctx.prev);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] }),
  meta: { successMessage: t('classes.moveSuccess') },
});
```

Error toast fires via the global `MutationCache.onError` (already in place).

### Click-to-edit

Clicking an event opens `<ClassEditDialog>` pre-filled with the selected class. The dialog is the exact same edit form that lives in `classes/index.tsx` today, extracted so both the legacy flow and the new calendar mount it.

### Styling

Tailwind-driven theme overrides in `class-calendar.css`. Classes are color-banded by `type` using the existing palette from `classes/index.tsx:45-49` (gi=blue, no-gi=primary, open-mat=cyan, kids=purple), applied via an `eventPropGetter` on the `<Calendar>` component. The RBC toolbar and time gutter get light tints to match the arena theme; we do not rebuild them from scratch.

## Section 2 — Student calendar

### Files

- Create: `apps/web/src/pages/classes/student-view.tsx`

### View

`<ClassCalendar>` with `view="day"`, `date={new Date()}`, `readOnly={true}`. Toolbar is hidden via RBC's `toolbar={false}` prop so students see only today's schedule without navigation controls.

### Interaction

- Active class (per existing `isActiveNow(cls)`) → event block renders a small inline "Check in" button that calls `handleProximityCheckin(cls.id)`.
- Already checked in today (per existing `isCheckedIn(classId)`) → block shows a "Checked in" indicator.
- Inactive → block is visible but non-interactive.

The `<ClassCalendar>` component accepts a `renderEvent?` prop so the student-specific button/badge composition lives in `student-view.tsx`, not inside the calendar.

### Empty state

If no classes scheduled for today, render the existing `t('common.noResults')` below the calendar. Calendar shell stays visible.

## Section 3 — Dashboard tweaks

### Files

- Modify: `apps/web/src/pages/dashboard.tsx`
- Modify: `apps/web/src/pages/settings.tsx`
- i18n keys: `totem.openTotem`, `totem.openTotemExplainer`, `classes.moveSuccess` in `apps/web/src/i18n/pt-BR.json` and `en.json`

### Dashboard

For instructors, add a primary action card at the top of the instructor block:

- Title: `t('totem.openTotem')`
- Subtitle: `t('totem.openTotemExplainer')`
- Button: opens `/totem` via `window.open('/totem', '_blank', 'noopener')`

Remove the entire `{isInstructor && academy && (<Card>…</Card>)}` block currently at `dashboard.tsx:107-134` and related state/helpers (`copied`, `handleCopy`, `handleShareWhatsApp`, `academy` query).

### Settings

Add an "Academy" section to `settings.tsx`, visible only to instructors. Contents are exactly what was on the dashboard: join-code display, copy button, WhatsApp share button. Bring along the `academy` query.

## Testing plan

### Unit

- `test/lib/schedule.test.ts` — pure `classesToCalendarEvents(classes, anchor, range)`:
  - week: classes materialize on their `dayOfWeek` with correct start/end Dates
  - day: only the anchor day's classes appear
  - month: events repeat across every week in the rendered month window, including spillover weeks
  - DST: anchor crossing a DST boundary preserves wall-clock times
- `test/hooks/use-class-calendar.test.tsx`:
  - `onEventDrop(id, newStart, newEnd)` converts to the correct `{ dayOfWeek, startTime, endTime }` and calls `onMove`
  - `onEventClick(id)` calls `onSelect` with the matching class
  - initial view is `week` on wide viewports and `day` on narrow (stub `matchMedia`)
- `test/pages/classes.test.tsx` (update existing):
  - instructor drag: simulate hook's `onEventDrop`, assert PUT body + optimistic update + success toast
  - instructor click: simulate hook's `onEventClick`, assert dialog opens pre-filled
  - student view: today's classes render, tap fires `handleProximityCheckin` via the event block
  - student empty state: empty classes → empty message, calendar shell visible
  - drag failure rollback: api rejection reverts optimistic change, error toast fires
- `test/pages/dashboard.test.tsx`:
  - totem card visible for instructors only, tapping calls `window.open('/totem', '_blank', 'noopener')`
  - join-code card NOT rendered on dashboard
- `test/pages/settings.test.tsx`:
  - join-code card visible for instructors
  - copy writes to clipboard
  - WhatsApp share opens correct URL

### e2e (Playwright)

- `tests/e2e/flows/classes-calendar.spec.ts`: instructor visits `/classes`, week view renders, click an event → edit dialog opens.

### Non-goals in tests

- react-big-calendar internal rendering correctness (trust library)
- DnD gesture reliability in e2e (unit tests cover drop→PUT pipeline)

## Risks

- **RBC CSS friction.** The library ships opinionated CSS that needs Tailwind overrides to match the arena theme. Mitigation: scope overrides to a single `class-calendar.css` file; accept that the toolbar chrome won't be pixel-identical to the rest of the app.
- **DST drift.** Event `start`/`end` reconstructed each render from `dayOfWeek + HH:mm`, so 08:00 stays visually at 08:00 across DST transitions. Unit test asserts this.
- **Touch drag sensitivity.** Mobile day-view drag can misfire. Mitigation: RBC's DnD addon accepts a `draggableAccessor` predicate; if touch drag proves awkward in practice, disable it in day view and instructors rearrange via the edit dialog on mobile.
- **Dialog extraction regression.** Moving the edit dialog touches the existing day-of-week edit flow. Mitigation: the existing `allows changing dayOfWeek when editing a class` test stays green; new tests cover calendar-triggered open.
- **Overlapping classes look crowded.** RBC stacks overlapping events side-by-side. Acceptable; we don't model rooms yet.

## Rollout

Single PR, no feature flag. Behavior change is uniformly better.
