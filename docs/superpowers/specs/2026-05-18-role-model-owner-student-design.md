# Role Model: Owner + Student (remove Instructor entirely)

Date: 2026-05-18
Status: Revised design (pending user spec review)

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
  (apps/api/src/routes/academies.ts:44; web sends `role: 'instructor'` from
  apps/web/src/pages/criar-academia.tsx:39).
- Web: ~27 scattered inline role checks across ~14 files (~21 are
  `role === 'instructor'`), no central helper, no client-side route guards.
  Shell selection in apps/web/src/App.tsx:156 is
  `isStudent ? StudentShell : StaffShell`.

Net effect: the `owner` role cannot reach the admin surface; "instructor" is
doing the job "owner" should do.

## Goal

The `instructor` role is **completely removed** — from the `user_role` enum,
from all role-based code, from seed data, and from user-facing copy. Two roles
remain:

- **owner** — gym master user. Full admin: everything currently gated by
  `requireInstructor` plus the existing owner-dashboard analytics.
- **student** — base member.

## Scope clarification: role vs. "class instructor"

"Instructor" as a **role** is removed. "Instructor" as **the person who teaches
a class** is a different concept and is **kept unchanged**:

- `class.instructorId` (apps/api/src/db/schema/class.ts:11) — FK to the user
  teaching the class. Kept. It now references an `owner`-role user.
- `checkins.ts:77,207` — reads `bjjClass.instructorId`. Kept.
- `apps/web/src/lib/schedule.ts:8` — `instructor?: string` display field
  (teacher's name). Kept.

## Non-goals

- No future role tiers.
- No new per-route academy-ownership verification beyond what already exists.
- No new client-side route guards (server stays authoritative; 403 on gated
  routes). Audit-flagged but out of scope.

## Design

### Database migration (new `0008`)

Postgres cannot drop a value from an enum in place, so the type is recreated.
Hand-written migration (drizzle-kit cannot safely generate enum-value removal);
the drizzle schema snapshot/meta is regenerated to match.

```sql
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "user" SET "role" = 'owner' WHERE "role" = 'instructor';
ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM('student', 'owner');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role"
  USING "role"::text::"user_role";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'student';
DROP TYPE "user_role_old";
```

Existing `role = 'instructor'` rows → `'owner'` (those users were the gym
admins / academy creators). No production data exists; dev DB is re-seeded.

`apps/api/src/db/schema/user.ts:5` → `pgEnum('user_role', ['student',
'owner'])`, default `'student'` (unchanged default).

### API (centralized — low risk)

1. **Rename `requireInstructor` → `requireOwner`** (apps/api/src/middleware/auth.ts).
   Body: `request.user.role !== 'owner'` → 403 `Forbidden: owner only`.
   Update all 29 route imports/usages.
2. **Rename existing `requireOwner` → `requireAcademyOwner`**
   (apps/api/src/middleware/require-owner.ts), behaviour unchanged (owner role
   + owns the academy in scope). Update its 5 owner-dashboard usages.
   Disambiguation contract:
   - `requireOwner` = "is an owner" (plain role gate).
   - `requireAcademyOwner` = "is an owner **and** owns this academy".
3. **academies.ts:44** — academy creator `role: 'instructor'` → `'owner'`.
   Joiner stays `'student'` (academies.ts:73, unchanged).
4. Test-mode header auth path (auth.ts:7–16) unchanged.

### Web (de-scatter)

1. **New helper** `apps/web/src/lib/roles.ts` exporting `isOwner(user)` and
   `isStudent(user)`. Accepts the loosely-typed user object used in both
   `session.user` (sidebar) and page `user` shapes; reads `role` as string.
2. Replace inline `role === 'instructor'` checks (~21) with `isOwner(...)`;
   inline `role === 'student'` checks with `isStudent(...)`. Exact set
   resolved by grep during implementation.
3. **App.tsx** shell: `const owner = isOwner(user); const Shell = owner ?
   StaffShell : StudentShell;`. Non-owner (student / pending) → StudentShell.
4. **sidebar.tsx** `isInstructor` → `isOwner`.
5. **criar-academia.tsx:39** — academy-creation payload `role: 'instructor'`
   → `'owner'`.
6. **i18n copy** (apps/web/src/i18n/en.json:239,241,250,253) — replace the
   "instructor" persona wording with "gym owner" / "academy owner" so copy
   matches the role model. pt-BR.json has no `instructor` literal; reviewed
   for the equivalent term during implementation. *(Product-wording call —
   flagged for user review.)*

### Seed

- apps/api/src/db/seed.ts: the seeded teaching user (Professor Silva) role
  `'instructor'` → `'owner'` (he is already set as `academy.ownerId`).
  `admin@admin.com` → `owner`; `aluno@aluno.com` → `student`. Drop
  `'instructor'` from the `createTestUser` role union. Passwords stay
  email-as-password.
- apps/api/src/db/seed-guide.ts: the guide `instructor` user (already set as
  `academy.ownerId`, line 136) role `'instructor'` → `'owner'`. Its id is
  reused as `class.instructorId` — that stays correct (an owner teaches).

## Testing (TDD — tests written first)

API (vitest, `x-test-user-*` header auth):

- `requireOwner`: owner → pass; student → 403; no session → 401.
- `requireAcademyOwner`: owner who owns academy → pass; owner not owning → 403;
  student → 403; no academyId → 400.
- `POST /api/academies` sets creator `role = 'owner'`.
- A representative gated route (e.g. `POST /api/classes`): owner → 2xx,
  student → 403.

Migration (vitest, against a migrated DB):

- A user row seeded with `role = 'instructor'` before migration ends up
  `'owner'` after.
- Enum `user_role` accepts only `student` / `owner`; inserting `'instructor'`
  raises a DB error.

Web (vitest + React Testing Library):

- `isOwner` / `isStudent` unit table (owner, student, null/undefined).
- App shell selection: owner → StaffShell; student → StudentShell.
- Sidebar: students/billing/settings links visible for owner only.
- 1–2 representative gated components (dashboard totem button; billing plans
  management section).

Static gate:

- Grep `apps/api/src` and `apps/web/src` — zero `instructor` as a **role**
  literal remains (`class.instructorId`, `schedule.ts` `instructor?` name
  field, and kept i18n strings, if any, are the only allowed survivors).

## Rollout

Implement on the current branch. After merge of code + migration `0008`,
re-seed the dev DB: `DROP SCHEMA public CASCADE; DROP SCHEMA drizzle CASCADE;`
→ migrate → seed (the `drizzle` ledger schema must also be dropped or migrate
skips table recreation). Verify both seed users sign in (HTTP 200) and land in
the correct shell.

## Risks

- Migration ordering: the column default must be dropped before the type
  swap and restored after, else the `ALTER TYPE` fails. Covered by the SQL
  above and the migration test.
- A missed inline check leaves an owner seeing student UI (or vice versa).
  Mitigation: central helper + the static grep gate.
- drizzle-kit snapshot/meta drift vs. the hand-written migration body.
  Mitigation: update `schema/user.ts`, run `drizzle-kit generate` to refresh
  the snapshot, then replace the generated migration body with the safe
  recreation SQL above (keep the generated snapshot/meta files).
