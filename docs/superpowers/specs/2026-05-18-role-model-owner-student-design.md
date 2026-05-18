# Role Model: Owner + Student (drop Instructor)

Date: 2026-05-18
Status: Approved design (pending user spec review)

## Problem

`user_role` enum = `['instructor', 'student', 'owner']`. The codebase conflates
"instructor" with "gym admin", leaving the `owner` role mostly powerless:

- `requireInstructor` (apps/api/src/middleware/auth.ts:29) gates **29 admin
  endpoints** with an exact `role === 'instructor'` check. An `owner` is
  rejected with 403 on every one of them.
- `requireOwner` (apps/api/src/middleware/require-owner.ts:7) gates **5
  owner-dashboard endpoints** with `role === 'owner'` **plus** an
  academy-ownership verification (the user must own the academy in scope).
- Academy creator is auto-assigned `role = 'instructor'`
  (apps/api/src/routes/academies.ts:44).
- Web: **~27 scattered inline role checks** across ~14 files (~21 are
  `role === 'instructor'`, the rest `'student'` / `'owner'`), no central
  helper, no client-side route guards. Shell selection in
  apps/web/src/App.tsx:156 is `isStudent ? StudentShell : StaffShell`.

Net effect: the `owner` role cannot reach the admin surface; "instructor" is
doing the job "owner" should do.

## Goal

Two effective roles:

- **owner** — gym master user. Full admin: everything currently gated by
  `requireInstructor` plus the existing owner-dashboard analytics.
- **student** — base member.

`instructor` is **dropped from use** but **kept in the enum**, reserved for a
future middle tier ("more than student, less than owner; no delete, no class
creation"). Nobody is assigned `instructor`.

## Non-goals

- No future instructor-tier capability logic now.
- No removal of the `instructor` enum value (avoids a risky Postgres enum
  migration; the value is reserved for near-future reuse).
- No new per-route academy-ownership verification beyond what already exists.
- No new client-side route guards. The audit flagged their absence, but the
  server remains authoritative (gated routes return 403); adding SPA guards is
  out of scope for this change.

## Design

### API (centralized — low risk)

1. **Rename `requireInstructor` → `requireOwner`** (apps/api/src/middleware/auth.ts).
   Body checks `request.user.role !== 'owner'` → 403 `Forbidden: owner only`.
   Update all 29 route imports/usages.
2. **Rename existing `requireOwner` → `requireAcademyOwner`**
   (apps/api/src/middleware/require-owner.ts). It keeps its current behaviour
   (role `owner` + the user owns the academy in scope). Update its 5
   owner-dashboard route usages. Disambiguation contract:
   - `requireOwner` = "is an owner" (plain role gate).
   - `requireAcademyOwner` = "is an owner **and** owns this academy".
3. **academies.ts:44** — academy creator role `'instructor'` → `'owner'`.
   Joiner stays `'student'` (academies.ts:73, unchanged).
4. Test-mode header auth path (auth.ts:7–16) unchanged.

### Web (de-scatter)

1. **New helper** `apps/web/src/lib/roles.ts` exporting `isOwner(user)` and
   `isStudent(user)`. Accepts the loosely-typed user object used in both
   `session.user` (sidebar) and page `user` shapes; reads `role` as string.
2. Replace the inline `role === 'instructor'` checks (~21) with
   `isOwner(...)`; replace inline `role === 'student'` checks with
   `isStudent(...)`. Exact set resolved by grep during implementation.
3. **App.tsx** shell selection: `const owner = isOwner(user); const Shell =
   owner ? StaffShell : StudentShell;`. Non-owner (student / pending) →
   StudentShell + student home redirect.
4. **sidebar.tsx** `isInstructor` → `isOwner` (students/billing/settings nav
   shown to owners only).

### Seed

- apps/api/src/db/seed.ts: `admin@admin.com` → role `owner` (reverts the prior
  interim instructor change); `aluno@aluno.com` → `student`. Drop `'instructor'`
  from the `createTestUser` role union. Passwords stay email-as-password.

## Data / migration

No schema migration. Enum unchanged. The only row currently holding
`role = 'instructor'` (admin@admin.com, set in a prior step) is corrected by
re-seeding the dev database. No production data exists.

## Testing (TDD — tests written first)

API (vitest, `x-test-user-*` header auth):

- `requireOwner`: owner → pass; student → 403; instructor → 403; no session → 401.
- `requireAcademyOwner`: owner who owns academy → pass; owner not owning → 403;
  student → 403; no academyId → 400.
- `POST /api/academies` sets creator `role = 'owner'`.
- A representative gated route (e.g. `POST /api/classes`): owner → 2xx,
  student → 403.

Web (vitest + React Testing Library):

- `isOwner` / `isStudent` unit table (owner, student, instructor, null/undefined).
- App shell selection: owner → StaffShell; student → StudentShell.
- Sidebar: students/billing/settings links visible for owner only.
- 1–2 representative gated components (dashboard totem button; billing plans
  management section).

## Rollout

Implement on the current branch. Re-seed the dev DB afterward
(`DROP SCHEMA public CASCADE; DROP SCHEMA drizzle CASCADE;` → migrate → seed —
note the `drizzle` ledger schema must also be dropped or migrate skips table
recreation). Verify both seed users sign in (HTTP 200) and land in the correct
shell.

## Risks

- A missed inline check leaves an owner seeing student UI (or vice versa).
  Mitigation: central helper + a final grep audit for any residual
  `'instructor'` string literal in apps/web/src and apps/api/src.
- Any non-dev environment row with `role = 'instructor'` would need a data fix.
  None exist (dev only).
