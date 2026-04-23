# Design — Presence history fix + Owner attendance dashboard

**Date:** 2026-04-23
**Author:** Iorran Castro (with Claude)

## Motivation

Two related pain points on the presence/attendance surface:

1. **Student presence history is broken.** The student-facing history page renders "Invalid Date" in the date column and raw class UUIDs in the class column. Two bugs combine: the component reads `c.date` on rows where the API actually returns `checkedInAt`, and the API returns unenriched check-in rows (no joined class name/type).
2. **Owners have no way to see the academy's attendance picture.** Today there is no view that answers "which classes are healthy?", "who came to No-Gi Monday?", or "which students are drifting away?" Instructors (including the owner) have a calendar of the schedule, but no visibility into actual attendance.

The academy also has no stored timezone, so all day-bucket queries silently use the server's timezone. This is the root cause of several latent bugs (`isClassActiveNow`, day-boundary queries on check-ins) and must be fixed before any date-aggregated owner dashboard is meaningful.

## Goals

- Fix the student presence history page so it shows real dates (in academy timezone) and human class names.
- Give the academy owner a single-page dashboard that surfaces:
  - Aderência per class for a selected period (day / week / month), as raw check-in counts.
  - A trend indicator (↑ / → / ↓) per class comparing this period to the rolling baseline of the last 4 occurrences of that class.
  - A per-class occurrence drill-down with the roster for any specific occurrence.
  - A students list bucketed by recent activity (active / slowing / drifting / inactive), with a drill-down into each student's history and stats.
- Establish a proper `owner` role and an `academy.timezone` field so authorization and date-bucketing are correct and future-proof.

## Non-goals

- **Per-class capacity / true attendance-rate metric.** Deferred. The rolling-baseline trend ships now; a `capacity` column on `bjjClass` and a real rate metric (`attended / capacity`) can be added later as a 1-column migration.
- **Per-class absence tracking via enrollments.** Modelling "who was expected but did not come" requires an enrollment table and a student-side opt-in UX. Deferred to a separate spec. This spec uses academy-level inactivity instead ("who hasn't trained in N days?") as the churn signal.
- **CSV export, push notifications, no-show alerts.** Not in this spec.
- **Multi-owner per academy.** Each academy has exactly one owner (`academy.ownerId`).
- **Student-side UX changes beyond the history bug fix.** Students see no new features.
- **Caching layers or materialized views.** Aggregations are computed on the fly in Postgres; fine at current academy sizes. Revisit if/when latency becomes an issue.

## Architecture

Three loosely-coupled pieces, one shared foundation:

```
Shared foundation
  ├─ migration: user_role += 'owner',  academy.timezone column (default 'Europe/Lisbon')
  ├─ requireOwner(academyId) middleware  (attaches academy + timezone to request context)
  └─ timezone-aware date helpers        (date_trunc(day, ts AT TIME ZONE tz))

Piece 1 — Student history bug fix
  └─ GET /api/checkins/student/:studentId        (LEFT JOIN bjjClass, TZ-aware date)
     └─ apps/web/src/pages/classes/checkin.tsx   (read checkedInAt + class.name)

Piece 2 — Owner dashboard API
  ├─ GET /api/owner/classes/aderencia
  ├─ GET /api/owner/classes/:classId/occurrences
  ├─ GET /api/owner/classes/:classId/occurrences/:date/roster
  ├─ GET /api/owner/students
  └─ GET /api/owner/students/:studentId/history

Piece 3 — Owner dashboard UI  (single page, three stacked sections, in-place drill-down)
  └─ apps/web/src/pages/owner/dashboard.tsx
     ├─ <AderenciaChart>       (recharts BarChart, 1 bar per class)
     ├─ <ClassesList>          (expandable rows → occurrence mini-chart + roster)
     └─ <StudentsList>         (status-chip filter, expandable rows → stats + history)
```

## Schema migrations

Two Drizzle migration files, ordered:

**Migration A — enum extension** (runs standalone, no transaction):
```sql
-- drizzle: no-transaction
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
```
Postgres requires `ALTER TYPE ... ADD VALUE` to run outside a transaction, and the new enum value is not visible to queries in the same transaction that added it — so the backfill cannot live in the same migration.

**Migration B — column add + backfill** (standard transactional migration, runs after A):
```sql
ALTER TABLE academy ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Lisbon';

UPDATE "user"
   SET role = 'owner'
 WHERE id IN (SELECT owner_id FROM academy WHERE owner_id IS NOT NULL);
```
The backfill is idempotent — safe to rerun.

The Drizzle schema (`apps/api/src/db/schema/user.ts`, `academy.ts`) is updated in lockstep with migration B.

## Authorization

A single middleware `requireOwner(academyId)`:

1. Resolves `academyId` from the route (path param or the authenticated user's `academyId`).
2. Loads the academy and its `ownerId` + `timezone` in one query.
3. Passes iff `req.user.id === academy.ownerId` **and** `req.user.role === 'owner'`. Belt-and-suspenders — the FK is the source of truth; the role enables cheap UI gating without a join.
4. Attaches `{ academy, timezone }` to the request context so handlers don't re-fetch.

All `/api/owner/*` routes go through it. The check-in routes stay as-is (students and instructors keep their existing access).

## API endpoints

All under `/api/owner/*`. All aggregations computed via Postgres `GROUP BY` over `checkin` joined with `bjjClass` and `user`, with day-bucketing via `date_trunc('day', checked_in_at AT TIME ZONE $academy_tz)`. No per-row aggregation in Node.

### 1. `GET /api/owner/classes/aderencia`

Query params: `period` (`day` | `week` | `month`, default `week`), `from` (ISO date, optional — defaults to start of current period in academy TZ).

Response:
```ts
{
  period: 'day' | 'week' | 'month';
  from: string;  // ISO date
  to: string;    // ISO date (exclusive)
  classes: Array<{
    classId: string;
    name: string;
    type: 'gi' | 'no-gi' | 'open-mat' | 'kids';
    totalCheckins: number;
    uniqueStudents: number;
    occurrences: number;              // count of distinct dates with >=1 checkin in the period
    avgPerOccurrence: number;
    trend: number | null;             // thisPeriodAvgPerOccurrence / rolling4OccBaseline; null if baseline unavailable
  }>;
}
```

Powers the aderência bar chart and the classes list.

### 2. `GET /api/owner/classes/:classId/occurrences`

Query params: `from`, `to` (both ISO dates, required — typically the selected period bounds or a larger lookback).

Response:
```ts
{
  classId: string;
  occurrences: Array<{
    date: string;            // ISO date in academy TZ
    checkins: number;
    uniqueStudents: number;
  }>;
}
```

Powers the inline per-class expansion (the mini occurrence-trend chart).

### 3. `GET /api/owner/classes/:classId/occurrences/:date/roster`

Path params: `classId`, `date` (ISO date in academy TZ).

Response:
```ts
{
  classId: string;
  date: string;
  students: Array<{
    id: string;
    name: string;
    belt: 'white' | 'blue' | 'purple' | 'brown' | 'black';
    checkedInAt: string;     // ISO timestamp
    source: 'button' | 'qr';
  }>;
}
```

Powers the roster view beneath the occurrence mini-chart.

### 4. `GET /api/owner/students`

Query params: `status` (`all` | `active` | `slowing` | `drifting` | `inactive`, default `all`).

Response:
```ts
{
  students: Array<{
    id: string;
    name: string;
    belt: string;
    lastCheckinAt: string | null;      // ISO timestamp, null if never
    daysSinceCheckin: number | null;   // whole days in academy TZ; null if never checked in
    status: 'active' | 'slowing' | 'drifting' | 'inactive';
  }>;
}
```

Buckets computed server-side against the academy timezone "today":
- `active` — 0–6 days since last check-in.
- `slowing` — 7–13 days.
- `drifting` — 14–29 days.
- `inactive` — ≥30 days, or never checked in (anchored to `createdAt`).

The owner themselves is filtered out of this list (management view shows students, not the owner's own activity).

### 5. `GET /api/owner/students/:studentId/history`

Query params: `from`, `to` (ISO dates, required).

Response:
```ts
{
  student: { id: string; name: string; belt: string };
  checkins: Array<{
    date: string;                     // ISO date in academy TZ
    checkedInAt: string;
    class: { id: string; name: string; type: string };
  }>;
  stats: {
    total: number;
    uniqueClasses: number;
    currentStreak: number;
    longestStreak: number;
  };
}
```

Powers the per-student inline expansion in the students list.

## Student-history bug fix

Outside `/api/owner/*`; piggy-backs on the shared timezone foundation.

**API** — `GET /api/checkins/student/:studentId` in `apps/api/src/routes/checkins.ts`:

- Adds a `LEFT JOIN bjj_class` so each row carries the class name and type.
- Applies the owning academy's timezone when shaping the response date (ISO date string in academy TZ).
- Response shape for each row:
  ```ts
  { id, date, checkedInAt, class: { id, name, type } }
  ```

**UI** — `apps/web/src/pages/classes/checkin.tsx`:

- Reads `c.date` (now populated) and `c.class.name` / `c.class.type`.
- Removes the `c.classId` fallback — if `c.class` is missing, it's a bug we want to surface, not mask.

## Latent bug: `isClassActiveNow` timezone

The check-in window check in `apps/api/src/utils/time-window.ts` currently uses server-local `getHours()` / `getMinutes()`. This silently breaks whenever the server TZ differs from the academy TZ (e.g., UTC server with a Lisbon academy during DST).

Rewrite to accept the academy timezone and compute the window in it. Called from the `POST /api/checkins` handler, which already has the academy context available.

Also fix the duplicate-prevention `startOfDay` / `endOfDay` calls in `POST /api/checkins`: they currently use server-local `new Date()` to bracket "today," which can admit or reject duplicates incorrectly when server TZ ≠ academy TZ. Use academy TZ for both.

Not strictly part of the owner dashboard, but sharing the timezone foundation makes these cheap to fix in the same spec. Skipping them would leave a trap where the dashboard shows correct dates while check-ins themselves are gated or deduped by wrong windows.

## Metric computation

### Rolling-baseline trend (per class)

Given a period P and a class C:

1. `thisAvg = totalCheckinsInP(C) / occurrencesInP(C)`. If `occurrencesInP == 0`, skip — the class doesn't appear in the response for that period.
2. `baseline = average check-ins over the last 4 occurrences of C ending strictly before P starts`.
3. If C has fewer than 3 prior occurrences, `trend = null`. The UI shows "—" rather than an arrow — we don't want to flag brand-new classes.
4. If `baseline == 0` (prior occurrences all had zero check-ins — rare but possible), `trend = null` to avoid division by zero / Infinity.
5. Otherwise: `trend = thisAvg / baseline`.

UI rendering:
- `trend >= 1.1` → up arrow, green.
- `0.9 <= trend < 1.1` → right arrow, grey.
- `trend < 0.9` → down arrow, red.
- `trend === null` → em dash, grey.

**Rationale for window length 4:** more reactive than an 8-week window; surfaces dips within a month rather than waiting two.

### Student inactivity buckets

For each student:

1. `lastCheckinAt = MAX(checkedInAt)` across all their check-ins. `NULL` if they've never checked in.
2. Convert both `lastCheckinAt` (or `createdAt` if null) and "now" to calendar dates in the academy timezone, then compute `daysSinceCheckin` as a whole-day integer.
3. Bucket via the thresholds above.

Computed entirely in SQL so it scales with academy size.

## Timezone handling

- `academy.timezone` is authoritative; `Europe/Lisbon` is the default.
- "Week" means the ISO week (Monday 00:00 – Sunday 23:59 in academy TZ). "Month" means the calendar month in academy TZ. "Day" means calendar day in academy TZ.
- `requireOwner` attaches the academy row (including `timezone`) to the request context. Handlers read from there, never from a module-level constant.
- SQL day-bucketing uses `date_trunc('day', checked_in_at AT TIME ZONE $tz)`.
- `from` / `to` / `date` query params are interpreted as **calendar dates in academy TZ**, converted to UTC-bounded timestamp ranges at the SQL layer.
- Wire format for dates is ISO date strings (`'2026-04-23'`). No embedded offsets in dates returned by the API; timestamps (`checkedInAt`) keep their ISO offset.
- The frontend formats dates with `toLocaleDateString('pt-PT', { timeZone: academy.timezone })` (academy TZ is surfaced via a context / session field so components don't re-query it).
- `DEFAULT_ACADEMY_TIMEZONE = 'Europe/Lisbon'` lives in a single shared constant used by the migration default and any place that needs a fallback.

## UI: owner dashboard

Single page at `/owner/dashboard` (new route), gated by role. Three stacked sections, one in-place expansion at a time per section.

Applies the existing design system: Shadcn cards, Tailwind spacing, recharts for the chart. The wireframe captured during brainstorming is structural only — rendering matches the app's current visual language.

**Section A — Period toggle + aderência chart.**
- Toggle: Day / Week / Month. Default: Week. State stored in the URL (`?period=week`).
- Chart: recharts `<BarChart>`, one bar per class, sorted by `totalCheckins` desc. X-axis class name + type; Y-axis check-in count. Tooltip shows `totalCheckins`, `uniqueStudents`, `avgPerOccurrence`, and the trend multiplier.

**Section B — Classes list.**
- Each row: class name · type · total check-ins · unique students · trend arrow.
- Click a row → in-place expansion with:
  - A small recharts `<LineChart>` of `occurrences[].checkins` from the `occurrences` endpoint, scoped to the current period plus an 8-occurrence lookback for context.
  - The roster for the most recent occurrence. Clicking another bar in the mini-chart swaps the roster.
- Only one class can be expanded at a time (clicking another closes the first).

**Section C — Students list.**
- Status-chip filter row at section top: `All` (default) · `Active` · `Slowing` · `Drifting` · `Inactive`. Counts next to each chip.
- Each row: student name · belt · status chip (colored) · days since last check-in.
- Click a row → in-place expansion with stats block (`total`, `uniqueClasses`, `currentStreak`, `longestStreak`) and a chronological check-in list for the current period.
- One student expansion at a time.
- The owner themselves does not appear in this list (already filtered server-side).

Navigation entry point: a new card in the instructor/owner dashboard at `/dashboard` linking to `/owner/dashboard`, shown only when `user.role === 'owner'`.

## Testing strategy

**API unit + integration tests** (one file per endpoint):

- Seeded fixtures: academy with Lisbon TZ, several classes, check-ins across multiple weeks.
- Each endpoint: positive path, authorization path (student → 403, instructor → 403, cross-academy owner → 403, matching owner → 200).
- Timezone tests: academy TZ = Lisbon, check-in at `2026-04-22T23:30:00Z` (UTC) counts under date `2026-04-23`. Repeat with a fake `America/Sao_Paulo` academy to prove the TZ is per-academy, not a constant.
- Trend edge cases: class with <3 prior occurrences → `trend: null`. Class with 4 prior occurrences all at 0 → `trend: null` (no divide-by-zero). Class trending up (this > baseline) and down.
- Inactivity edge cases: student who has never checked in → `inactive`. Students exactly on the 7 / 14 / 30-day boundaries are placed in the higher-activity bucket (< operator, not ≤).
- Owner-self-exclusion: owner-as-student is not in `GET /api/owner/students`.

**Bug-fix regression tests:**

- `GET /api/checkins/student/:studentId` returns rows with `class.name` populated and `date` in academy TZ.
- UI test for `apps/web/src/pages/classes/checkin.tsx`: given a fixture response, the table shows a real date string and the class name — no "Invalid Date", no UUID.

**UI integration tests** (same stack used by existing dashboard tests):

- Owner dashboard loads: chart, classes list, students list all render.
- Clicking a class row expands it and loads the occurrence mini-chart + latest roster.
- Clicking a student row expands it and loads stats + history.
- Non-owner roles hitting `/owner/dashboard` are shown a 403 page (consistent with other role-gated routes in the app).
- Status-chip filter updates the students list.

**Migration tests:**

- Run the migration on a clone of a realistic seed DB. Verify: `owner` enum value exists, `academy.timezone` is populated with `Europe/Lisbon` for all pre-existing rows, users referenced by `academy.ownerId` have `role = 'owner'`.
- Rerun the migration's backfill statement (idempotency check).

**`isClassActiveNow` regression:** a test fixing academy TZ = Lisbon, server TZ = UTC, class start 19:00 Lisbon → active window correct across DST boundaries.

## Open follow-ups

- **Capacity / true attendance rate.** Add `bjjClass.capacity`, extend the aderência endpoint to return `rate = attendees / capacity`, add a toggle in the chart.
- **Enrollment-based absence tracking.** Dedicated follow-up spec; introduces an enrollment table and a student-side opt-in UX.
- **Owner-level totem / QR display.** Out of scope here but natural next step.
- **Push notifications on churn signals** (e.g., student crossed into `drifting`).
