# Role Model: Owner + Student (remove Instructor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `instructor` role entirely; `owner` becomes the gym admin (full access), `student` the member.

**Architecture:** Two phases keep every commit green. **Phase A** gives `owner` the admin power (rename guards, repoint routes, web helper) while the enum still contains `instructor` (unused) so the test suite stays green. **Phase B** eradicates `instructor` — enum-recreation migration, seed/web/i18n/test-helper renames, static grep gate.

**Tech Stack:** Fastify + better-auth + drizzle-orm (Postgres) API; React + react-router + vitest/RTL web; drizzle-kit migrations; npm workspaces + turbo.

**Spec:** `docs/superpowers/specs/2026-05-18-role-model-owner-student-design.md`

---

## File Structure

- `apps/api/src/middleware/auth.ts` — `requireInstructor` → `requireOwner` (plain `role==='owner'` gate).
- `apps/api/src/middleware/require-owner.ts` — `requireOwner` → `requireAcademyOwner` (owner role + owns academy).
- `apps/api/src/routes/*.ts` — repoint guard imports/usages (12 files for the first, `owner-dashboard.ts` for the second).
- `apps/api/src/routes/academies.ts:44` — creator role `'instructor'` → `'owner'`.
- `apps/api/src/db/schema/user.ts:5` — enum `['student','owner']`.
- `apps/api/drizzle/0008_*.sql` + `apps/api/drizzle/meta/*` — enum-recreation migration + snapshot.
- `apps/api/src/db/seed.ts`, `apps/api/src/db/seed-guide.ts` — seeded staff user role `'owner'`.
- `apps/api/test/helpers.ts` — `createTestInstructor` → `createTestOwner` (role `'owner'`).
- `apps/web/src/lib/roles.ts` — **new** `isOwner` / `isStudent`.
- `apps/web/src/App.tsx`, `apps/web/src/components/layout/sidebar.tsx`, ~21 page/component files — use `isOwner`.
- `apps/web/src/pages/criar-academia.tsx:39` — signup payload `role:'owner'`.
- `apps/web/src/i18n/en.json` — persona copy.
- Tests: `apps/api/test/role-guards.test.ts` (new), `apps/api/test/role-migration.test.ts` (new), `apps/api/test/owner-dashboard.test.ts` (wording), `apps/web/test/lib/roles.test.ts` (new), `apps/web/test/App.test.tsx` (shell), `apps/web/test/components/sidebar.test.tsx` (new).

---

# PHASE A — Owner gains admin power (enum unchanged, suite green)

## Task A1: Web role helper `isOwner` / `isStudent`

**Files:**
- Create: `apps/web/src/lib/roles.ts`
- Test: `apps/web/test/lib/roles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/test/lib/roles.test.ts
import { describe, it, expect } from 'vitest';
import { isOwner, isStudent } from '@/lib/roles';

describe('roles helper', () => {
  it('isOwner true only for owner role', () => {
    expect(isOwner({ role: 'owner' })).toBe(true);
    expect(isOwner({ role: 'student' })).toBe(false);
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
    expect(isOwner({})).toBe(false);
  });

  it('isStudent true only for student role', () => {
    expect(isStudent({ role: 'student' })).toBe(true);
    expect(isStudent({ role: 'owner' })).toBe(false);
    expect(isStudent(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace @pgt/web -- roles`
Expected: FAIL — cannot resolve `@/lib/roles`.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/roles.ts
type MaybeUser = { role?: string | null } | null | undefined;

export function isOwner(user: MaybeUser): boolean {
  return (user?.role ?? '') === 'owner';
}

export function isStudent(user: MaybeUser): boolean {
  return (user?.role ?? '') === 'student';
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test --workspace @pgt/web -- roles`
Expected: PASS (5+ assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/roles.ts apps/web/test/lib/roles.test.ts
git commit -m "feat(web): add isOwner/isStudent role helper"
```

---

## Task A2: API guards — `requireOwner` + `requireAcademyOwner`

Rename order matters: rename the **ownership-verifying** guard first (frees the
`requireOwner` name), then turn `requireInstructor` into `requireOwner`.

**Files:**
- Modify: `apps/api/src/middleware/require-owner.ts`
- Modify: `apps/api/src/routes/owner-dashboard.ts`
- Modify: `apps/api/src/middleware/auth.ts:29-35`
- Modify: 12 route files importing `requireInstructor`
- Modify: `apps/api/src/routes/academies.ts:44`
- Modify: `apps/api/test/helpers.ts:79-90` (createTestInstructor body)
- Modify: `apps/api/test/owner-dashboard.test.ts` (stale "instructor" wording)
- Test: `apps/api/test/role-guards.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/role-guards.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema/index.js';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, authHeaders, testDb } from './helpers.js';

describe('requireOwner (plain owner-role gate) via POST /api/classes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  const body = { name: 'Gi', type: 'gi', recurrence: 'weekly', dayOfWeek: 1, startTime: '07:00', endTime: '08:30' };

  it('owner -> not 403', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const res = await app.inject({ method: 'POST', url: '/api/classes', headers: authHeaders(owner), payload: { ...body, instructorId: owner.id } });
    expect(res.statusCode).not.toBe(403);
  });

  it('student -> 403', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { role: 'student' });
    const res = await app.inject({ method: 'POST', url: '/api/classes', headers: authHeaders(student), payload: body });
    expect(res.statusCode).toBe(403);
  });

  it('no session -> 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/classes', payload: body });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAcademyOwner via GET /api/owner/students', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('owner who owns the academy -> 200', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(200);
  });

  it('owner who does NOT own the academy -> 403', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' }); // academy.ownerId stays null
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(403);
  });

  it('student -> 403', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { role: 'student' });
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(student) });
    expect(res.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace @pgt/api -- role-guards`
Expected: FAIL — `requireOwner` (in classes route) currently checks
`role==='instructor'`, so the owner case returns 403.

- [ ] **Step 3: Rename the ownership-verifying guard**

In `apps/api/src/middleware/require-owner.ts` rename the export
`requireOwner` → `requireAcademyOwner` (function name only; body unchanged):

```ts
export async function requireAcademyOwner(request: FastifyRequest, reply: FastifyReply) {
  // ...unchanged body...
}
```

Update its only importer:

```bash
cd /Users/iorran/pgt/apps/api
sed -i '' 's/requireOwner/requireAcademyOwner/g' src/routes/owner-dashboard.ts
```

- [ ] **Step 4: Convert `requireInstructor` → `requireOwner`**

Replace `apps/api/src/middleware/auth.ts:29-35` with:

```ts
export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.role !== 'owner') {
    return reply.status(403).send({ error: 'Forbidden: owner only' });
  }
}
```

Repoint every importer/usage (12 route files):

```bash
cd /Users/iorran/pgt/apps/api
grep -rl 'requireInstructor' src/routes | xargs sed -i '' 's/requireInstructor/requireOwner/g'
```

- [ ] **Step 5: Academy creator becomes owner**

`apps/api/src/routes/academies.ts:44` — change `role: 'instructor'` to:

```ts
      .set({ academyId: created!.id, role: 'owner', status: 'active' })
```

- [ ] **Step 6: Make the test instructor factory create an owner**

`apps/api/test/helpers.ts` — change the body of `createTestInstructor`
(keep the name this phase to avoid churn; renamed in Phase B):

```ts
export async function createTestInstructor(
  academyId: string,
  overrides: Partial<typeof schema.user.$inferInsert> = {},
) {
  return createTestUser(academyId, {
    role: 'owner',
    belt: 'black',
    name: 'Test Owner',
    ...overrides,
  });
}
```

Then fix stale wording in `apps/api/test/owner-dashboard.test.ts`: the test
`'returns 403 for instructors who are not the academy owner'` — rename the
`it(...)` description to `'returns 403 for an owner who is not the academy
owner'` (assertion already expects 403; `createTestInstructor` now yields an
owner-role user with no `academy.ownerId`, so it still 403s via
`requireAcademyOwner`).

- [ ] **Step 7: Run the new test + full API suite**

Run: `npm test --workspace @pgt/api -- role-guards`
Expected: PASS.

Run: `npm test --workspace @pgt/api`
Expected: PASS — entire API suite green (enum still has `instructor`; nobody
uses it; all admin routes now require `owner`; factory yields owners).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): owner is the admin role; requireOwner + requireAcademyOwner"
```

---

## Task A3: Web — shell, sidebar, inline checks use `isOwner`

**Files:**
- Modify: `apps/web/src/App.tsx:156-157,167`
- Modify: `apps/web/src/components/layout/sidebar.tsx:10`
- Modify: ~13 page/component files with inline `role === 'instructor'`
- Modify: `apps/web/src/pages/criar-academia.tsx:39`
- Test: `apps/web/test/App.test.tsx` (shell), `apps/web/test/components/sidebar.test.tsx` (new)

- [ ] **Step 1: Write the failing sidebar test**

```tsx
// apps/web/test/components/sidebar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const sessionMock = vi.fn();
vi.mock('@/lib/auth-client', () => ({ useSession: () => sessionMock() }));

import { Sidebar } from '@/components/layout/sidebar';

function renderSidebar() {
  return render(<MemoryRouter><Sidebar /></MemoryRouter>);
}

describe('Sidebar role gating', () => {
  beforeEach(() => sessionMock.mockReset());

  it('shows students/billing/settings for owner', () => {
    sessionMock.mockReturnValue({ data: { user: { role: 'owner' } } });
    renderSidebar();
    expect(screen.getByText('nav.students')).toBeInTheDocument();
    expect(screen.getByText('nav.billing')).toBeInTheDocument();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('hides them for student', () => {
    sessionMock.mockReturnValue({ data: { user: { role: 'student' } } });
    renderSidebar();
    expect(screen.queryByText('nav.students')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.billing')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.settings')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace @pgt/web -- sidebar`
Expected: FAIL — `isInstructor` is `role === 'instructor'`; owner sees nothing.

- [ ] **Step 3: Repoint sidebar + App shell**

`apps/web/src/components/layout/sidebar.tsx`:

```ts
import { isOwner } from '@/lib/roles';
// ...
  const { data: session } = useSession();
  const showStaff = isOwner((session?.user as any) ?? null);
```
Replace the three `show: isInstructor` with `show: showStaff` (lines 15,16,20).

`apps/web/src/App.tsx`:

```ts
import { isOwner } from '@/lib/roles';
// ...
  const owner = isOwner(user as any);
  const Shell = owner ? StaffShell : StudentShell;
  const studentHome = '/classes';
```
Line 167: `element={owner ? <DashboardPage /> : <Navigate to={studentHome} replace />}`.

- [ ] **Step 4: Repoint remaining inline instructor checks**

List exact sites:

```bash
cd /Users/iorran/pgt
grep -rn "role === 'instructor'\|role === \"instructor\"\|=== 'instructor'" apps/web/src
```

For each match (notification-bell.tsx, pages/dashboard.tsx, pages/settings.tsx,
pages/classes/index.tsx, pages/marketplace/index.tsx, pages/marketplace/orders.tsx,
pages/gamification/results.tsx, pages/gamification/seasons.tsx,
pages/students/detail.tsx, pages/tournaments/index.tsx, pages/billing/plans.tsx):
add `import { isOwner } from '@/lib/roles';` and replace the boolean
`<expr>?.role === 'instructor'` with `isOwner(<expr> as any)` (keep the same
variable, e.g. `const isInstructor = ...` → `const isOwnerUser = isOwner(user as any)`
and rename local usages in that file). Replace inline `role === 'student'`
with `isStudent(...)` likewise. Do one file per edit; after each, run that
file's existing test if present.

`apps/web/src/pages/criar-academia.tsx:39` — change `role: 'instructor'` to
`role: 'owner'`.

- [ ] **Step 5: Add/adjust the App shell test**

In `apps/web/test/App.test.tsx`, add (or adjust existing) cases asserting an
`owner` user renders `StaffShell` markers and a `student` renders
`StudentShell` markers. Follow the existing mock pattern in that file and
`apps/web/test/render.tsx`.

- [ ] **Step 6: Run web suite**

Run: `npm test --workspace @pgt/web`
Expected: PASS (sidebar, roles, App, and pre-existing web tests green).

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): owner-based shell/sidebar/route gating via isOwner"
```

---

# PHASE B — Eradicate `instructor`

## Task B1: Enum-recreation migration `0008`

**Files:**
- Modify: `apps/api/src/db/schema/user.ts:5`
- Create: `apps/api/drizzle/0008_*.sql` (+ regenerated `apps/api/drizzle/meta/*`)
- Test: `apps/api/test/role-migration.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/role-migration.test.ts
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb } from './helpers.js';

describe('user_role enum after migration 0008', () => {
  it('contains exactly student, owner', async () => {
    const rows = await testDb.execute(sql`
      SELECT e.enumlabel AS label
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' ORDER BY 1
    `);
    const labels = (rows as unknown as { label: string }[]).map(r => r.label).sort();
    expect(labels).toEqual(['owner', 'student']);
  });

  it('rejects inserting role = instructor', async () => {
    await expect(
      testDb.execute(sql`
        INSERT INTO "user" (email, name, role)
        VALUES ('x@x.com', 'X', 'instructor'::user_role)
      `),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace @pgt/api -- role-migration`
Expected: FAIL — enum still contains `instructor`.

- [ ] **Step 3: Update the schema enum**

`apps/api/src/db/schema/user.ts:5`:

```ts
export const userRoleEnum = pgEnum('user_role', ['student', 'owner']);
```

- [ ] **Step 4: Generate the migration + snapshot, then replace its body**

```bash
cd /Users/iorran/pgt/apps/api
npx drizzle-kit generate
```

This creates `drizzle/0008_*.sql` and updates `drizzle/meta/`. **Overwrite the
generated `0008_*.sql` file contents** with the safe enum-recreation SQL
(drizzle-kit's default for enum-value removal is not transactional-safe):

```sql
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
UPDATE "user" SET "role" = 'owner' WHERE "role" = 'instructor';
ALTER TYPE "user_role" RENAME TO "user_role_old";
CREATE TYPE "user_role" AS ENUM('student', 'owner');
ALTER TABLE "user" ALTER COLUMN "role" TYPE "user_role" USING "role"::text::"user_role";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'student';
DROP TYPE "user_role_old";
```

Keep the regenerated `drizzle/meta/*` files as produced by drizzle-kit (do not
hand-edit the snapshot).

- [ ] **Step 5: Run migration test (test DB auto-migrates via globalSetup)**

Run: `npm test --workspace @pgt/api -- role-migration`
Expected: PASS — globalSetup applies `0008` to `pgt_test`; enum now
`{student,owner}`, instructor insert rejected.

- [ ] **Step 6: Run full API suite**

Run: `npm test --workspace @pgt/api`
Expected: PASS — no code path assigns `instructor` after Phase A; factory
yields `owner`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema/user.ts apps/api/drizzle apps/api/test/role-migration.test.ts
git commit -m "feat(api): migration 0008 — remove instructor from user_role enum"
```

---

## Task B2: Rename test factory + seed + i18n

**Files:**
- Modify: `apps/api/test/helpers.ts` (rename `createTestInstructor` → `createTestOwner`)
- Modify: 18 `apps/api/test/*.test.ts` files using `createTestInstructor`
- Modify: `apps/api/src/db/seed.ts`, `apps/api/src/db/seed-guide.ts`
- Modify: `apps/web/src/i18n/en.json:239,241,250,253`

- [ ] **Step 1: Rename the factory + its callers**

```bash
cd /Users/iorran/pgt/apps/api
grep -rl 'createTestInstructor' test src | xargs sed -i '' 's/createTestInstructor/createTestOwner/g'
```

In `test/helpers.ts` also update the comment `// Factory: create instructor`
→ `// Factory: create owner` and the auto-class comment `// Factory: create
class (auto-creates an instructor if none provided)` → `... an owner ...`.

- [ ] **Step 2: Seed scripts → owner**

`apps/api/src/db/seed.ts`: in the instructor insert block change `role:
'instructor'` to `role: 'owner'` and rename the `instructor` local to `owner`
for clarity (it is already used as `academy.ownerId` and `bjjClass.instructorId`).
In `createTestUser`'s role union drop `'instructor'` so it reads
`role: 'owner' | 'student'`; `admin@admin.com` stays `role: 'owner'`,
`aluno@aluno.com` stays `role: 'student'`.

`apps/api/src/db/seed-guide.ts`: in `instructorValues` change `role:
'instructor'` to `role: 'owner'` (keep the variable name; it remains the
academy owner and the class `instructorId`).

- [ ] **Step 3: i18n copy**

`apps/web/src/i18n/en.json` — replace:
- 239 `"createAcademyDesc": "I'm a gym owner and want to register my academy"`
- 241 `"haveCodeDesc": "I'm a student and received a code from my gym"`
- 250 `"waitingMessage": "Your registration has been submitted. The gym owner will approve your access soon."`
- 253 `"rejectedMessage": "Unfortunately your registration was rejected by the gym owner."`

Check `apps/web/src/i18n/pt-BR.json` for the matching keys and align the
Portuguese wording (the literal `instructor` does not appear there; update the
equivalent persona term in those same 4 keys).

- [ ] **Step 4: Run both suites**

Run: `npm test --workspace @pgt/api && npm test --workspace @pgt/web`
Expected: PASS — factory renamed consistently, seeds compile.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web/src/i18n
git commit -m "refactor: rename test owner factory; seeds + i18n drop instructor"
```

---

## Task B3: Static grep gate + dev re-seed verification

**Files:**
- Create: `apps/api/test/no-instructor-role.test.ts` (new)

- [ ] **Step 1: Write the gate test**

```ts
// apps/api/test/no-instructor-role.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('no instructor role literal survives', () => {
  it('apps/api/src + apps/web/src have no role-instructor string', () => {
    // Allowed survivors: class.instructorId, schedule.ts `instructor?` name
    // field, and the *Owner test factory. Match the standalone word
    // "instructor" only as a role-ish string literal.
    const out = execSync(
      `grep -rnE "['\\"]instructor['\\"]" apps/api/src apps/web/src || true`,
      { cwd: '/Users/iorran/pgt', encoding: 'utf8' },
    ).trim();
    expect(out).toBe('');
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test --workspace @pgt/api -- no-instructor-role`
Expected: PASS (Phase A/B removed every `'instructor'` / `"instructor"`
string literal in `src`; `instructorId` is an identifier, not a quoted
literal, so it is not matched).
If it fails, the printed `grep` output lists each remaining literal — fix each
to `'owner'`/`'student'` or via `isOwner`, then re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/no-instructor-role.test.ts
git commit -m "test: static gate — no instructor role literal in src"
```

- [ ] **Step 4: Re-seed dev DB and verify end-to-end**

```bash
cd /Users/iorran/pgt
docker compose exec -T postgres psql -U postgres -d pgt -c 'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
npm run db:migrate
npm run db:seed
```

Then with the API running (`workspace:4`):

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"admin@admin.com","password":"admin@admin.com"}' -w '\n%{http_code}\n'
curl -s -X POST http://localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"aluno@aluno.com","password":"aluno@aluno.com"}' -w '\n%{http_code}\n'
```

Expected: both `200`; admin user JSON shows `"role":"owner"`, aluno
`"role":"student"`. Confirm `psql -d pgt -c "SELECT DISTINCT role FROM
\"user\";"` returns only `owner`, `student`.

- [ ] **Step 5: Final commit (if any verification tweaks)**

```bash
git add -A
git commit -m "chore: re-seed dev db on owner/student role model" || true
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** migration+enum (B1) ✓; requireOwner/requireAcademyOwner + 29/5 routes (A2) ✓; academies creator (A2 step5) ✓; web helper (A1) + shell/sidebar/inline + criar-academia (A3) ✓; seed/seed-guide (B2) ✓; i18n copy (B2 step3) ✓; role-vs-class-instructor kept (no task touches `class.instructorId`/`schedule.ts`) ✓; tests: guards (A2), migration (B1), web helper/sidebar/shell (A1/A3), static gate (B3) ✓; rollout re-seed (B3 step4) ✓.
- **Placeholder scan:** none — every code/command step has concrete content.
- **Type consistency:** `isOwner`/`isStudent` signature identical across A1/A3; `requireOwner` (auth.ts) vs `requireAcademyOwner` (require-owner.ts) used consistently; `createTestOwner` name used only after B2 rename (A2 deliberately keeps `createTestInstructor` to stay green, documented).
