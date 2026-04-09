# User Guide Audit & Screenshot Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit both user guides against current app behavior, capture canonical Playwright screenshots from a dedicated seed, update guides inline, and surface them from the root README.

**Architecture:** Three phases. Phase 1 produces a reviewable gap inventory (no destructive edits). Phase 2 ships a standalone `seed-guide.ts` fixture script plus a `capture-guide-screenshots.mjs` Playwright runner. Phase 3 applies audit findings to the guide files and surfaces them from `README.md`.

**Tech Stack:**
- Monorepo: npm workspaces + turbo.
- API: Fastify + Drizzle ORM (postgres-js driver) at `apps/api`. Test runner: vitest with a real Postgres at `localhost:5433/pgt_test`.
- Web: Vite + React 19 + react-router-dom v7 at `apps/web`. Dev server at `http://localhost:5173`.
- New: `@playwright/test` (launcher only — no test runner) added as a root devDependency for screenshot capture.

**Spec:** `docs/superpowers/specs/2026-04-09-user-guide-audit-design.md`

---

## File Structure

**New files:**
- `apps/api/src/db/seed-guide.ts` — canonical fixture seed script.
- `apps/api/test/seed-guide.test.ts` — unit tests for idempotency + entity counts.
- `scripts/capture-guide-screenshots.mjs` — Playwright screenshot runner (root-level so both apps can be orchestrated).
- `scripts/README.md` — how to run the capture script locally.
- `docs/user-guide-audit.md` — temporary Phase 1 gap inventory (deleted in Phase 3).
- `docs/assets/user-guide/instructor/*.png` — captured instructor screenshots.
- `docs/assets/user-guide/student/*.png` — captured student screenshots.

**Modified files:**
- `apps/api/package.json` — add `db:seed:guide` script.
- `package.json` (root) — add `db:seed:guide` passthrough + `@playwright/test` devDependency + `screenshots:capture` script.
- `docs/User Guide - Instructor.md` — inline edits per audit findings, wikilink conversion, screenshot embeds.
- `docs/User Guide - Student.md` — same treatment.
- `README.md` — new "Documentation" section.

**Deleted at end of Phase 3:**
- `docs/user-guide-audit.md` (scaffolding).

---

# Phase 1 — Gap Inventory

Phase 1 produces a single reviewable document. No destructive edits. Ends with a user review gate.

## Task 1.1: Inventory all web pages and their routes

**Files:**
- Create: `docs/user-guide-audit.md` (starts empty, grows across Phase 1 tasks)

- [ ] **Step 1: Create audit scaffold file**

Create `docs/user-guide-audit.md` with this exact initial content:

```markdown
---
title: User Guide Audit Findings
tags:
  - audit
  - internal
---

# User Guide Audit Findings

> **Temporary working document.** Deleted at the end of Phase 3 of
> [[2026-04-09-user-guide-audit-design|User Guide Audit Design]].

## Route Inventory

| Route | Page component | Role(s) | Guide section | Status |
| ----- | -------------- | ------- | ------------- | ------ |

## Gap Table

| Guide section | Role | Current text (summary) | Actual app behavior | Action | Screenshot slug |
| ------------- | ---- | ---------------------- | ------------------- | ------ | --------------- |

## Screenshot Shot List

(Populated in Task 1.4)
```

- [ ] **Step 2: Fill in the Route Inventory from `apps/web/src/App.tsx`**

For each route registered in `apps/web/src/App.tsx` (both unauthenticated and authenticated branches), add one row to the **Route Inventory** table:

- `Route` column: the path literal (e.g., `/billing`).
- `Page component` column: the imported component and source file path (e.g., `BillingOverduePage — apps/web/src/pages/billing/index.tsx`).
- `Role(s)` column: which role(s) can reach the route. Infer from `App.tsx` conditional branches (`!session`, `!user.academyId`, `user.status === 'pending'`, `user.status === 'rejected'`, and the authenticated section which is shared instructor + student).
- `Guide section` column: leave `TBD` for now (filled in Task 1.3).
- `Status` column: leave blank.

The full list of routes to include (from `App.tsx`):
- Unauthenticated: `/login`, `/signup`, `/criar-academia`, `/entrar/:code`, `/forgot-password`, `/reset-password`, `/checkin`.
- No academy: `/criar-academia`, `/entrar/:code`.
- Pending: `/aguardando`.
- Authenticated: `/`, `/pending`, `/classes`, `/classes/history`, `/students`, `/students/:id`, `/billing`, `/billing/plans`, `/billing/payments`, `/marketplace`, `/marketplace/orders`, `/gamification`, `/gamification/seasons`, `/gamification/results`, `/gamification/profile`, `/tournaments`, `/settings`, `/totem`, `/checkin`.

- [ ] **Step 3: Commit the scaffold**

```bash
git add docs/user-guide-audit.md
git commit -m "docs: scaffold user guide audit doc"
```

## Task 1.2: Extract each page's user-visible contract

For each row in the Route Inventory, open the page component file and extract:
- All visible pt-BR labels, button text, headings.
- Empty / loading / error states.
- Navigation entry points (where the user lands on this page from) and exits (where buttons/links take them).

**Files:**
- Read: each file listed in the Route Inventory under `apps/web/src/pages/**`.
- Modify: `docs/user-guide-audit.md` — add a new section `## Page Contracts` below the Route Inventory with one sub-section per page.

- [ ] **Step 1: Add a `## Page Contracts` section**

Append to `docs/user-guide-audit.md` under the Route Inventory:

```markdown
## Page Contracts

(One sub-section per page. Extracted from source, not from guide.)
```

- [ ] **Step 2: For each page file, append a contract sub-section**

Template:

```markdown
### `/<route>` — `<PageComponent>`

**File:** `apps/web/src/pages/<path>.tsx`
**Role:** <instructor | student | both | unauth>
**Labels / buttons (pt-BR):**
- "<exact string>"
- "<exact string>"
**States:** <empty | loading | error | success descriptions>
**Entry points:** <how the user gets here>
**Exit points:** <where buttons/links lead>
```

Work through the full route list from Task 1.1 sequentially. Do not skip any page, including `aguardando`, `settings`, `totem`, `checkin-scan`.

- [ ] **Step 3: Commit the contracts**

```bash
git add docs/user-guide-audit.md
git commit -m "docs: extract page contracts for audit"
```

## Task 1.3: Cross-reference against both guide files

**Files:**
- Read: `docs/User Guide - Instructor.md`, `docs/User Guide - Student.md`
- Modify: `docs/user-guide-audit.md` — update the Route Inventory's `Guide section` column and populate the Gap Table.

- [ ] **Step 1: Map each route to its guide section(s)**

Open both guide files. For each row in the Route Inventory, find the guide heading(s) that document that flow. Update the `Guide section` column with:
- The exact heading text and the file it's in, e.g., `"Approve Students" (Instructor)`.
- `MISSING` if no guide section documents the flow at all.
- `—` if the route is intentionally not documented (e.g., internal `/checkin` QR scanner).

- [ ] **Step 2: Fill the Gap Table**

For every row where there's a discrepancy, add a Gap Table row:

- `Guide section` — the current heading (or `(new)` if missing).
- `Role` — Instructor / Student.
- `Current text (summary)` — one sentence summary of what the guide says today (or `(not documented)`).
- `Actual app behavior` — one sentence describing what the code actually does.
- `Action` — one of: `Add` (new section), `Update` (rewrite existing), `Remove` (stale section describing features no longer present), `Verify` (likely accurate, capture screenshot and move on).
- `Screenshot slug` — kebab-case identifier, e.g., `approve-students`, `billing-quick-pay`, `student-checkin-mobile`. Screenshot slugs are drawn from the guide section, not the route.

- [ ] **Step 3: Commit the cross-reference**

```bash
git add docs/user-guide-audit.md
git commit -m "docs: cross-reference guides against page contracts"
```

## Task 1.4: Build the screenshot shot list

**Files:**
- Modify: `docs/user-guide-audit.md` — populate the `## Screenshot Shot List` section.

- [ ] **Step 1: Collect distinct screenshot slugs**

Walk the Gap Table and collect every distinct `Screenshot slug`. For each slug, add one shot list row with this structure:

```markdown
| Slug | Role | Route | Viewport | Login as | Prep steps | Notes |
| ---- | ---- | ----- | -------- | -------- | ---------- | ----- |
| approve-students | Instructor | /pending | desktop | instrutor@demo.pgt | none | Should show the faixa-branca pending student |
```

Columns:
- `Slug` — the kebab-case identifier.
- `Role` — which demo user to log in as.
- `Route` — the URL path.
- `Viewport` — `desktop` (1440×900) or `mobile` (390×844). Only `checkin-scan`, `totem`, and any shot explicitly called out as mobile use `mobile`.
- `Login as` — one of: `instrutor@demo.pgt`, `joao.azul@demo.pgt`, `maria.roxa@demo.pgt`, `pedro.branca.overdue@demo.pgt`, `lucas.branca.pending@demo.pgt`, or `(unauth)`.
- `Prep steps` — any clicks/navigation needed after landing on the route before capturing (e.g., "Click Ativos tab").
- `Notes` — what the screenshot should demonstrate.

- [ ] **Step 2: Commit the shot list**

```bash
git add docs/user-guide-audit.md
git commit -m "docs: add screenshot shot list to audit"
```

## Task 1.5: Phase 1 review gate

- [ ] **Step 1: Stop and hand off to user**

Announce to the user:

> Phase 1 complete. Gap inventory is at `docs/user-guide-audit.md`. Please review:
> 1. Are the Route Inventory's Guide section mappings correct?
> 2. Does the Gap Table capture the drift you expected?
> 3. Is the screenshot shot list reasonable?
>
> Approve, or list changes needed before Phase 2.

Do not proceed to Phase 2 until the user explicitly approves the audit findings.

---

# Phase 2 — Fixtures & Screenshots

## Task 2.1: Write a failing test for `seed-guide.ts`

**Files:**
- Create: `apps/api/test/seed-guide.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/api/test/seed-guide.test.ts`:

```typescript
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, testDb } from './helpers';
import { seedGuide } from '../src/db/seed-guide';
import {
  academy,
  user,
  bjjClass,
  membershipPlan,
  studentMembership,
  payment,
  tournament,
  product,
} from '../src/db/schema/index';
import { eq, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

async function countDemo() {
  const [acad] = await testDb
    .select()
    .from(academy)
    .where(eq(academy.slug, 'demo-pgt'));
  if (!acad) {
    return {
      academy: null,
      users: 0,
      classes: 0,
      plans: 0,
      memberships: 0,
      payments: 0,
      tournaments: 0,
      products: 0,
    };
  }
  const users = await testDb
    .select()
    .from(user)
    .where(eq(user.academyId, acad.id));
  const classes = await testDb
    .select()
    .from(bjjClass)
    .where(eq(bjjClass.academyId, acad.id));
  const plans = await testDb
    .select()
    .from(membershipPlan)
    .where(eq(membershipPlan.academyId, acad.id));
  const memberships = await testDb
    .select()
    .from(studentMembership)
    .innerJoin(user, eq(studentMembership.studentId, user.id))
    .where(eq(user.academyId, acad.id));
  const payments = await testDb
    .select()
    .from(payment)
    .where(eq(payment.academyId, acad.id));
  const tournaments = await testDb
    .select()
    .from(tournament)
    .where(eq(tournament.academyId, acad.id));
  const products = await testDb
    .select()
    .from(product)
    .where(eq(product.academyId, acad.id));
  return {
    academy: acad,
    users: users.length,
    classes: classes.length,
    plans: plans.length,
    memberships: memberships.length,
    payments: payments.length,
    tournaments: tournaments.length,
    products: products.length,
  };
}

describe('seedGuide', () => {
  it('creates the canonical demo academy with expected entity counts', async () => {
    await seedGuide({ db: testDb });

    const counts = await countDemo();
    expect(counts.academy).not.toBeNull();
    expect(counts.academy?.name).toBe('Academia Demo PGT');
    expect(counts.academy?.city).toBe('Lisboa');
    expect(counts.users).toBe(5); // 1 instructor + 4 students
    expect(counts.classes).toBeGreaterThanOrEqual(2);
    expect(counts.classes).toBeLessThanOrEqual(3);
    expect(counts.plans).toBe(1);
    expect(counts.memberships).toBe(3); // 4 students but 1 is pending → no membership yet
    expect(counts.payments).toBeGreaterThanOrEqual(3); // azul has 3 months paid
    expect(counts.tournaments).toBe(1);
    expect(counts.products).toBe(1);
  });

  it('is idempotent — running twice leaves the same state', async () => {
    await seedGuide({ db: testDb });
    const first = await countDemo();

    await seedGuide({ db: testDb });
    const second = await countDemo();

    expect(second.academy?.id).toBe(first.academy?.id);
    expect(second).toEqual(first);
  });

  it('does not touch other academies', async () => {
    // Seed an unrelated academy
    const [other] = await testDb
      .insert(academy)
      .values({
        name: 'Other Academy',
        slug: 'other',
        joinCode: 'OTHER-1',
        city: 'Other City',
      })
      .returning();

    await seedGuide({ db: testDb });

    const [stillThere] = await testDb
      .select()
      .from(academy)
      .where(eq(academy.slug, 'other'));
    expect(stillThere).toBeDefined();
    expect(stillThere.id).toBe(other.id);
  });

  it('creates the instructor with the canonical email and role', async () => {
    await seedGuide({ db: testDb });

    const [instructor] = await testDb
      .select()
      .from(user)
      .where(
        and(
          eq(user.email, 'instrutor@demo.pgt'),
          eq(user.role, 'instructor'),
        ),
      );
    expect(instructor).toBeDefined();
    expect(instructor.status).toBe('active');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/api && npm test -- seed-guide
```

Expected: FAIL. The error will be `Cannot find module '../src/db/seed-guide'`.

## Task 2.2: Create `seed-guide.ts` with exports

**Files:**
- Create: `apps/api/src/db/seed-guide.ts`

- [ ] **Step 1: Write the seed module**

Create `apps/api/src/db/seed-guide.ts`:

```typescript
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { db as defaultDb } from './client.js';
import * as schema from './schema/index.js';

// Canonical constants — change these and every screenshot will reseed deterministically.
export const DEMO_ACADEMY_SLUG = 'demo-pgt';
export const DEMO_ACADEMY_NAME = 'Academia Demo PGT';
export const DEMO_ACADEMY_CITY = 'Lisboa';
export const DEMO_JOIN_CODE = 'PGT-DEMO-001';

export const DEMO_INSTRUCTOR_EMAIL = 'instrutor@demo.pgt';
export const DEMO_PASSWORD = 'demo-pgt-2026';

export const DEMO_STUDENTS = {
  azul: 'joao.azul@demo.pgt',
  roxa: 'maria.roxa@demo.pgt',
  brancaOverdue: 'pedro.branca.overdue@demo.pgt',
  brancaPending: 'lucas.branca.pending@demo.pgt',
} as const;

type Db = typeof defaultDb;

interface SeedGuideOptions {
  db?: Db;
}

/**
 * Seeds the canonical "Academia Demo PGT" fixtures used by the documentation
 * screenshot capture script. Idempotent: drops and reseeds only the demo-pgt
 * academy and its dependent rows, leaving all other academies untouched.
 */
export async function seedGuide(
  options: SeedGuideOptions = {},
): Promise<void> {
  const db = (options.db ?? defaultDb) as Db;

  // 1. Idempotency: remove any existing demo academy (cascades via the delete
  //    order below — we delete dependents first because the schema does not
  //    declare ON DELETE CASCADE across all FKs).
  const existing = await db
    .select()
    .from(schema.academy)
    .where(eq(schema.academy.slug, DEMO_ACADEMY_SLUG));

  if (existing.length > 0) {
    const demoId = existing[0].id;
    await db
      .delete(schema.payment)
      .where(eq(schema.payment.academyId, demoId));
    // Delete memberships via student ids
    const demoUsers = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.academyId, demoId));
    for (const u of demoUsers) {
      await db
        .delete(schema.studentMembership)
        .where(eq(schema.studentMembership.studentId, u.id));
    }
    await db
      .delete(schema.membershipPlan)
      .where(eq(schema.membershipPlan.academyId, demoId));
    await db
      .delete(schema.product)
      .where(eq(schema.product.academyId, demoId));
    await db
      .delete(schema.tournament)
      .where(eq(schema.tournament.academyId, demoId));
    await db
      .delete(schema.bjjClass)
      .where(eq(schema.bjjClass.academyId, demoId));
    // Clear owner before deleting users
    await db
      .update(schema.academy)
      .set({ ownerId: null })
      .where(eq(schema.academy.id, demoId));
    await db.delete(schema.user).where(eq(schema.user.academyId, demoId));
    await db.delete(schema.academy).where(eq(schema.academy.id, demoId));
  }

  // 2. Academy
  const [acad] = await db
    .insert(schema.academy)
    .values({
      name: DEMO_ACADEMY_NAME,
      slug: DEMO_ACADEMY_SLUG,
      joinCode: DEMO_JOIN_CODE,
      city: DEMO_ACADEMY_CITY,
    })
    .returning();

  // 3. Instructor
  const [instructor] = await db
    .insert(schema.user)
    .values({
      academyId: acad.id,
      email: DEMO_INSTRUCTOR_EMAIL,
      name: 'Professora Demo PGT',
      role: 'instructor',
      belt: 'black',
      dateOfBirth: '1985-03-15',
      status: 'active',
    })
    .returning();

  await db
    .update(schema.academy)
    .set({ ownerId: instructor.id })
    .where(eq(schema.academy.id, acad.id));

  // 4. Students — 4 varied states
  const [azul, roxa, brancaOverdue, brancaPending] = await db
    .insert(schema.user)
    .values([
      {
        academyId: acad.id,
        email: DEMO_STUDENTS.azul,
        name: 'João Silva',
        role: 'student',
        belt: 'blue',
        dateOfBirth: '1995-06-20',
        status: 'active',
      },
      {
        academyId: acad.id,
        email: DEMO_STUDENTS.roxa,
        name: 'Maria Oliveira',
        role: 'student',
        belt: 'purple',
        dateOfBirth: '1992-11-10',
        status: 'active',
      },
      {
        academyId: acad.id,
        email: DEMO_STUDENTS.brancaOverdue,
        name: 'Pedro Souza',
        role: 'student',
        belt: 'white',
        dateOfBirth: '1998-04-22',
        status: 'active',
      },
      {
        academyId: acad.id,
        email: DEMO_STUDENTS.brancaPending,
        name: 'Lucas Pereira',
        role: 'student',
        belt: 'white',
        dateOfBirth: '2000-01-15',
        status: 'pending',
      },
    ])
    .returning();

  // 5. Plan
  const [plan] = await db
    .insert(schema.membershipPlan)
    .values({
      academyId: acad.id,
      name: 'Mensal Ilimitado',
      price: '180.00',
      frequency: 'monthly',
      classesPerWeek: null,
    })
    .returning();

  // 6. Memberships (active students only — pending student has none yet)
  // Use a deterministic due day that makes Pedro overdue and João/Maria current.
  const now = new Date();
  const dueDay = Math.max(1, Math.min(28, now.getDate() - 5));
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  // Start Pedro's membership 3 months ago so he can be multi-month overdue.
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  await db.insert(schema.studentMembership).values([
    {
      studentId: azul.id,
      planId: plan.id,
      startDate: threeMonthsAgoStr,
      dueDay,
    },
    {
      studentId: roxa.id,
      planId: plan.id,
      startDate: monthStart,
      dueDay,
    },
    {
      studentId: brancaOverdue.id,
      planId: plan.id,
      startDate: threeMonthsAgoStr,
      dueDay,
    },
  ]);

  // 7. Payments
  // João (azul): 3 months paid, up to date.
  const paymentRows: (typeof schema.payment.$inferInsert)[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, dueDay);
    const refMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const paymentDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`;
    paymentRows.push({
      studentId: azul.id,
      academyId: acad.id,
      amount: '180.00',
      paymentDate,
      referenceMonth: refMonth,
      recordedBy: instructor.id,
    });
  }
  // Pedro (branca overdue): paid 3 months ago only — leaves 2 months + current overdue.
  {
    const d = new Date(now.getFullYear(), now.getMonth() - 3, dueDay);
    const refMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    paymentRows.push({
      studentId: brancaOverdue.id,
      academyId: acad.id,
      amount: '180.00',
      paymentDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`,
      referenceMonth: refMonth,
      recordedBy: instructor.id,
    });
  }
  // Maria (roxa): current month NOT yet paid — leaves her eligible for quick-pay.
  await db.insert(schema.payment).values(paymentRows);

  // 8. Classes — 2 weekly recurring so dashboard and classes page have content.
  await db.insert(schema.bjjClass).values([
    {
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Manhã',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    },
    {
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'No-Gi Noite',
      type: 'no-gi',
      recurrence: 'weekly',
      dayOfWeek: 3,
      startTime: '19:00',
      endTime: '20:30',
    },
  ]);

  // 9. Tournament
  const inTwoMonths = new Date(now.getFullYear(), now.getMonth() + 2, 15);
  await db.insert(schema.tournament).values({
    academyId: acad.id,
    name: 'Open Lisboa 2026',
    date: `${inTwoMonths.getFullYear()}-${String(inTwoMonths.getMonth() + 1).padStart(2, '0')}-${String(inTwoMonths.getDate()).padStart(2, '0')}`,
    location: 'Lisboa, Portugal',
    createdBy: instructor.id,
  });

  // 10. Marketplace product
  await db.insert(schema.product).values({
    academyId: acad.id,
    name: 'Kimono Academia Demo',
    description: 'Kimono oficial da Academia Demo PGT',
    price: '450.00',
    stock: 10,
    createdBy: instructor.id,
  });
}

// CLI entry point — allows `npx tsx src/db/seed-guide.ts` from apps/api.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedGuide()
    .then(() => {
      console.log('✓ seed-guide complete');
      process.exit(0);
    })
    .catch((e) => {
      console.error('✗ seed-guide failed:', e);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Verify the test still fails with a schema-specific error, not a module error**

```bash
cd apps/api && npm test -- seed-guide
```

Expected: The test should now find the module but may fail on schema mismatches. This is expected — the schema details (field names for `tournament.createdBy`, `product.stock`, etc.) must be verified against the actual schema files.

- [ ] **Step 3: Reconcile the seed against actual schemas**

Read each referenced schema file and fix any column name mismatches in `seed-guide.ts`:

```bash
# These are the exact files to verify against:
# apps/api/src/db/schema/academy.ts
# apps/api/src/db/schema/user.ts
# apps/api/src/db/schema/class.ts
# apps/api/src/db/schema/membership.ts
# apps/api/src/db/schema/payment.ts
# apps/api/src/db/schema/tournament.ts
# apps/api/src/db/schema/product.ts
```

Read each, compare every column name and nullability against the `.values({...})` objects in `seed-guide.ts`, and update the seed as needed. Common things to check:
- `tournament` — may use `creatorId` or a different name instead of `createdBy`.
- `product` — may have required fields like `sku`, `category` that aren't set.
- `bjjClass.recurrence` — confirm enum values.
- `user.dateOfBirth` — confirm it's nullable or required.

After reconciling, rerun:

```bash
cd apps/api && npm test -- seed-guide
```

Expected: all four tests PASS. If any test still fails, fix the seed (not the test) and rerun.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/seed-guide.ts apps/api/test/seed-guide.test.ts
git commit -m "feat(api): add seed-guide script for documentation fixtures"
```

## Task 2.3: Wire up `db:seed:guide` npm script

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Add the api workspace script**

In `apps/api/package.json`, add to the `scripts` object:

```json
"db:seed:guide": "tsx src/db/seed-guide.ts"
```

Place it right after `"db:seed": "tsx src/db/seed.ts"`.

- [ ] **Step 2: Add the root passthrough script**

In `/Users/iorran/pgt/package.json`, add to the `scripts` object:

```json
"db:seed:guide": "turbo db:seed:guide --filter=@pgt/api"
```

Place it right after `"db:seed": "turbo db:seed --filter=@pgt/api"`.

- [ ] **Step 3: Verify both scripts work**

```bash
cd /Users/iorran/pgt && npm run db:seed:guide
```

Expected: The seed runs against your local dev DB and prints `✓ seed-guide complete`. If it fails with a connection error, the dev DB may need to be started first (`docker-compose up -d` or similar).

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json package.json
git commit -m "chore: add db:seed:guide npm script"
```

## Task 2.4: Install `@playwright/test` as a root devDependency

**Files:**
- Modify: `/Users/iorran/pgt/package.json`
- Modify: `/Users/iorran/pgt/package-lock.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/iorran/pgt && npm install --save-dev @playwright/test
```

- [ ] **Step 2: Install Playwright browsers**

```bash
cd /Users/iorran/pgt && npx playwright install chromium
```

Expected: Chromium is downloaded (~170 MB). Other browsers are not needed — we only screenshot one browser.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @playwright/test for screenshot capture"
```

## Task 2.5: Write the screenshot capture script

**Files:**
- Create: `scripts/capture-guide-screenshots.mjs`
- Create: `scripts/README.md`

- [ ] **Step 1: Create `scripts/capture-guide-screenshots.mjs`**

Create `scripts/capture-guide-screenshots.mjs`:

```javascript
/**
 * Captures canonical screenshots for the user guides.
 *
 * Prerequisites:
 *   1. Dev DB running.
 *   2. `npm run db:seed:guide` executed (creates Academia Demo PGT fixtures).
 *   3. API running: `npm run dev --workspace=@pgt/api`.
 *   4. Web dev server running at http://localhost:5173: `npm run dev --workspace=@pgt/web`.
 *
 * Usage:
 *   node scripts/capture-guide-screenshots.mjs
 *
 * Overwrites PNGs in docs/assets/user-guide/{instructor,student}/.
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const BASE_URL = process.env.PGT_DEV_URL ?? 'http://localhost:5173';
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'user-guide');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// These credentials MUST match apps/api/src/db/seed-guide.ts exports.
const PASSWORD = 'demo-pgt-2026';
const INSTRUCTOR = 'instrutor@demo.pgt';
const STUDENT_AZUL = 'joao.azul@demo.pgt';
const STUDENT_ROXA = 'maria.roxa@demo.pgt';
const STUDENT_OVERDUE = 'pedro.branca.overdue@demo.pgt';
// Pending student is a special case — only used for the "pending approval" shot.
// eslint-disable-next-line no-unused-vars
const STUDENT_PENDING = 'lucas.branca.pending@demo.pgt';

/**
 * Shot definitions. Each entry produces exactly one PNG.
 *
 * IMPORTANT: keep this list in sync with docs/user-guide-audit.md Shot List
 * during Phase 1 review. Add/remove shots here, not in the guide files.
 */
const SHOTS = [
  // --- Instructor shots ---
  {
    slug: 'dashboard',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/',
    viewport: DESKTOP,
  },
  {
    slug: 'approve-students',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/pending',
    viewport: DESKTOP,
  },
  {
    slug: 'students-list',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/students',
    viewport: DESKTOP,
  },
  {
    slug: 'classes',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/classes',
    viewport: DESKTOP,
  },
  {
    slug: 'billing-overdue',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/billing',
    viewport: DESKTOP,
  },
  {
    slug: 'billing-plans',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/billing/plans',
    viewport: DESKTOP,
  },
  {
    slug: 'billing-payments',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/billing/payments',
    viewport: DESKTOP,
  },
  {
    slug: 'marketplace',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/marketplace',
    viewport: DESKTOP,
  },
  {
    slug: 'tournaments',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/tournaments',
    viewport: DESKTOP,
  },
  {
    slug: 'gamification-leaderboard',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/gamification',
    viewport: DESKTOP,
  },
  {
    slug: 'settings',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/settings',
    viewport: DESKTOP,
  },
  {
    slug: 'totem',
    role: 'instructor',
    login: INSTRUCTOR,
    path: '/totem',
    viewport: MOBILE,
  },

  // --- Student shots ---
  {
    slug: 'dashboard',
    role: 'student',
    login: STUDENT_AZUL,
    path: '/',
    viewport: DESKTOP,
  },
  {
    slug: 'classes',
    role: 'student',
    login: STUDENT_AZUL,
    path: '/classes',
    viewport: DESKTOP,
  },
  {
    slug: 'billing-current',
    role: 'student',
    login: STUDENT_ROXA,
    path: '/billing',
    viewport: DESKTOP,
  },
  {
    slug: 'billing-overdue',
    role: 'student',
    login: STUDENT_OVERDUE,
    path: '/billing',
    viewport: DESKTOP,
  },
  {
    slug: 'gamification-profile',
    role: 'student',
    login: STUDENT_AZUL,
    path: '/gamification/profile',
    viewport: DESKTOP,
  },
  {
    slug: 'checkin-scan',
    role: 'student',
    login: STUDENT_AZUL,
    path: '/checkin',
    viewport: MOBILE,
  },
];

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function login(page, email) {
  await page.goto(`${BASE_URL}/login`);
  // NOTE: selectors are placeholders — adjust to match the actual login form
  // after running the first capture and inspecting the DOM.
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  // Wait for the app to route away from /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 10_000,
  });
}

async function logout(page) {
  // Navigate to settings and click logout — or clear cookies as a fallback.
  await page.context().clearCookies();
}

async function captureShot(browser, shot) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
  });
  const page = await context.newPage();
  try {
    await login(page, shot.login);
    await page.goto(`${BASE_URL}${shot.path}`);
    // Give the page a beat to settle (images, async data).
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await page.waitForTimeout(500);

    const outPath = path.join(OUT_DIR, shot.role, `${shot.slug}.png`);
    await ensureDir(path.dirname(outPath));
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  ✓ ${shot.role}/${shot.slug}.png`);
  } catch (err) {
    console.error(`  ✗ ${shot.role}/${shot.slug}: ${err.message}`);
    throw err;
  } finally {
    await logout(page);
    await context.close();
  }
}

async function main() {
  console.log(`→ Capturing ${SHOTS.length} screenshots from ${BASE_URL}`);
  console.log(`→ Output: ${OUT_DIR}`);
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      await captureShot(browser, shot);
    }
  } finally {
    await browser.close();
  }
  console.log('✓ Capture complete');
}

main().catch((e) => {
  console.error('✗ Capture failed:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Create `scripts/README.md`**

Create `scripts/README.md`:

```markdown
# scripts/

Utility scripts for the PGT monorepo.

## `capture-guide-screenshots.mjs`

Captures canonical PNGs for the user guides by driving the local dev server with Playwright.

### Prerequisites

1. Dev Postgres running (e.g., `docker-compose up -d`).
2. Migrations applied: `npm run db:migrate`.
3. Guide fixtures seeded: `npm run db:seed:guide`.
4. API dev server: `npm run dev --workspace=@pgt/api`.
5. Web dev server at http://localhost:5173: `npm run dev --workspace=@pgt/web`.

### Run

```bash
node scripts/capture-guide-screenshots.mjs
```

Or via the root script:

```bash
npm run screenshots:capture
```

PNGs are written to `docs/assets/user-guide/{instructor,student}/`, overwriting any existing files with the same slug.

### Adding a new shot

Edit the `SHOTS` array in `capture-guide-screenshots.mjs`. Each entry needs:
- `slug` — kebab-case file name (without extension).
- `role` — `instructor` or `student`.
- `login` — demo user email from `apps/api/src/db/seed-guide.ts`.
- `path` — the in-app URL to capture.
- `viewport` — `DESKTOP` (1440×900) or `MOBILE` (390×844).
```

- [ ] **Step 3: Add the root `screenshots:capture` script**

In `/Users/iorran/pgt/package.json`, add to the `scripts` object:

```json
"screenshots:capture": "node scripts/capture-guide-screenshots.mjs"
```

- [ ] **Step 4: Commit the script shell**

```bash
git add scripts/capture-guide-screenshots.mjs scripts/README.md package.json
git commit -m "chore(docs): add screenshot capture script shell"
```

## Task 2.6: Run the capture script and fix selectors

**Files:**
- Modify: `scripts/capture-guide-screenshots.mjs` (as needed)
- Create: `docs/assets/user-guide/instructor/*.png`, `docs/assets/user-guide/student/*.png`

- [ ] **Step 1: Start all prerequisites in separate terminals**

Terminal 1 (dev Postgres): ensure it's running.
Terminal 2 (API): `npm run dev --workspace=@pgt/api`
Terminal 3 (Web): `npm run dev --workspace=@pgt/web`

Wait for both dev servers to be ready at their logged URLs.

- [ ] **Step 2: Run the seed**

```bash
cd /Users/iorran/pgt && npm run db:seed:guide
```

Expected: `✓ seed-guide complete`.

- [ ] **Step 3: Run the capture script**

```bash
cd /Users/iorran/pgt && npm run screenshots:capture
```

Expected: all shots succeed. If any fail, the most likely causes are:
- **Login selectors wrong** — open `apps/web/src/pages/login.tsx` and update the selectors in `login()` to match the actual form inputs and button text.
- **Password mismatch** — the `seed-guide` script doesn't create auth records; you may need to add an account row via BetterAuth's signup flow instead. If so, extend `seedGuide()` to call the BetterAuth signup endpoint (via `fetch` against the running API) for each demo user, then rerun the seed and the capture.
- **Route gates** — e.g., the pending student can't reach `/billing`. Cross-check each shot's login + path against the `App.tsx` routing branches.

Iterate on `capture-guide-screenshots.mjs` until every shot in the `SHOTS` array produces a valid PNG.

- [ ] **Step 4: Manually eyeball the output**

```bash
ls docs/assets/user-guide/instructor docs/assets/user-guide/student
```

Open a few PNGs (e.g., `docs/assets/user-guide/instructor/billing-overdue.png`) in a viewer. Verify:
- Text is pt-BR.
- No login/error screens slipped through.
- Multi-month overdue shows on Pedro's row.
- Maria's billing shows quick-pay current month.
- Mobile shots (`checkin-scan`, `totem`) are at 390×844.

- [ ] **Step 5: Commit the PNGs and any selector fixes**

```bash
git add scripts/capture-guide-screenshots.mjs docs/assets/user-guide
git commit -m "docs: capture canonical screenshots for user guides"
```

## Task 2.7: Phase 2 review gate

- [ ] **Step 1: Hand off to user**

Announce:

> Phase 2 complete. Screenshots captured to `docs/assets/user-guide/`. Please skim the PNGs and flag anything that looks wrong (login screens, empty states, wrong language). I'll re-run the capture script for any fixes before moving to Phase 3.

Do not proceed to Phase 3 until the user approves the screenshots.

---

# Phase 3 — Guide Edits & README

## Task 3.1: Convert Obsidian wikilinks to standard markdown links

**Files:**
- Modify: `docs/User Guide - Instructor.md`
- Modify: `docs/User Guide - Student.md`

- [ ] **Step 1: Find all wikilinks in both guides**

```bash
grep -n '\[\[' "docs/User Guide - Instructor.md" "docs/User Guide - Student.md"
```

Expected output includes at least:
```
docs/User Guide - Instructor.md:15:> - [[User Guide - Student|Guia do Aluno]]
```
(There may be more — capture all of them.)

- [ ] **Step 2: Replace each wikilink with a relative markdown link**

For each match:
- `[[User Guide - Student|Guia do Aluno]]` → `[Guia do Aluno](./User%20Guide%20-%20Student.md)`
- `[[User Guide - Instructor|Guia do Instrutor]]` → `[Guia do Instrutor](./User%20Guide%20-%20Instructor.md)`
- `[[OtherNote]]` → `[OtherNote](./OtherNote.md)` (if any appear)

Use `Edit` for each occurrence. The URL encoding for spaces (`%20`) is required for GitHub rendering.

- [ ] **Step 3: Verify no wikilinks remain**

```bash
grep -n '\[\[' "docs/User Guide - Instructor.md" "docs/User Guide - Student.md"
```

Expected: no output (exit code 1).

- [ ] **Step 4: Commit**

```bash
git add "docs/User Guide - Instructor.md" "docs/User Guide - Student.md"
git commit -m "docs: convert wikilinks to standard markdown for GitHub"
```

## Task 3.2: Apply audit findings to `User Guide - Instructor.md`

**Files:**
- Read: `docs/user-guide-audit.md` (the approved Gap Table from Phase 1)
- Modify: `docs/User Guide - Instructor.md`

- [ ] **Step 1: Work through every Gap Table row with Role = Instructor**

For each instructor row in the Gap Table:
- If Action = `Add`: insert a new section in the appropriate location in the guide (follow the existing structure — "Primeiros Passos", "Gerenciando Alunos", etc.). Use the existing bilingual format: pt-BR heading + `<sub><em>English</em></sub>`, pt-BR body + `<sub><em>English</em></sub>` under each paragraph/step.
- If Action = `Update`: rewrite the matching section to reflect the actual app behavior from the audit's Page Contracts.
- If Action = `Remove`: delete the stale section entirely.
- If Action = `Verify`: no text changes needed; the screenshot step below still applies.

- [ ] **Step 2: Embed a screenshot in every updated or added section**

For each section with a screenshot slug in the Gap Table, add a markdown image immediately below the section heading:

```markdown
### Aprovar Novos Alunos
<sub><em>Approve New Students</em></sub>

![Aprovar alunos pendentes](./assets/user-guide/instructor/approve-students.png)

Quando um aluno entra com seu código, ele aparece como **Pendente**.
...
```

The alt text should be in pt-BR. The path is relative to the guide file.

- [ ] **Step 3: Verify all referenced image paths exist**

```bash
grep -o './assets/user-guide/instructor/[a-z-]*\.png' "docs/User Guide - Instructor.md" | sort -u | while read p; do
  if [ ! -f "docs/${p#./}" ]; then echo "MISSING: $p"; fi
done
```

Expected: no "MISSING" output. If anything is missing, either the slug is wrong in the guide or the shot is missing from Phase 2 — fix whichever is off.

- [ ] **Step 4: Commit**

```bash
git add "docs/User Guide - Instructor.md"
git commit -m "docs: refresh Instructor guide with audit findings and screenshots"
```

## Task 3.3: Apply audit findings to `User Guide - Student.md`

**Files:**
- Read: `docs/user-guide-audit.md`
- Modify: `docs/User Guide - Student.md`

- [ ] **Step 1: Work through every Gap Table row with Role = Student**

Same procedure as Task 3.2 Step 1 but for student rows. Preserve the bilingual format and the existing guide structure.

- [ ] **Step 2: Embed screenshots**

Same procedure as Task 3.2 Step 2, using paths like `./assets/user-guide/student/billing-overdue.png`.

- [ ] **Step 3: Verify image paths exist**

```bash
grep -o './assets/user-guide/student/[a-z-]*\.png' "docs/User Guide - Student.md" | sort -u | while read p; do
  if [ ! -f "docs/${p#./}" ]; then echo "MISSING: $p"; fi
done
```

Expected: no "MISSING" output.

- [ ] **Step 4: Commit**

```bash
git add "docs/User Guide - Student.md"
git commit -m "docs: refresh Student guide with audit findings and screenshots"
```

## Task 3.4: Update root `README.md` with a Documentation section

**Files:**
- Read: `README.md`
- Modify: `README.md`

- [ ] **Step 1: Read the current README to find the best insertion point**

```bash
head -40 README.md
```

- [ ] **Step 2: Insert the Documentation section**

Add a new `## Documentation` section near the top of the README (after the project title and tagline, before any "Getting Started" or "Installation" section). Exact content:

```markdown
## Documentation

User guides for the PGT BJJ academy management app (Portuguese primary, English sub-captions):

- [Guia do Instrutor — Instructor Guide](./docs/User%20Guide%20-%20Instructor.md)
- [Guia do Aluno — Student Guide](./docs/User%20Guide%20-%20Student.md)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: link user guides from README"
```

## Task 3.5: Delete the audit scaffold file

**Files:**
- Delete: `docs/user-guide-audit.md`

- [ ] **Step 1: Delete the file**

```bash
rm docs/user-guide-audit.md
```

- [ ] **Step 2: Commit the deletion**

```bash
git add -u docs/user-guide-audit.md
git commit -m "docs: remove audit scaffold after Phase 3 landing"
```

## Task 3.6: Final verification

- [ ] **Step 1: Verify no stray wikilinks or TODO markers**

```bash
grep -rn '\[\[' "docs/User Guide - Instructor.md" "docs/User Guide - Student.md" README.md || echo "✓ no wikilinks"
grep -rn 'TODO\|TBD' "docs/User Guide - Instructor.md" "docs/User Guide - Student.md" || echo "✓ no placeholders"
```

Both should print the `✓` line.

- [ ] **Step 2: Verify all images resolve from the guides**

```bash
for guide in "docs/User Guide - Instructor.md" "docs/User Guide - Student.md"; do
  grep -oE '!\[[^]]*\]\(\./assets/[^)]+\)' "$guide" | sed -E 's|!\[[^]]*\]\(\.\/([^)]+)\)|docs/\1|' | while read p; do
    if [ ! -f "$p" ]; then echo "MISSING: $p (referenced by $guide)"; fi
  done
done
```

Expected: no "MISSING" output.

- [ ] **Step 3: Verify the api test suite still passes**

```bash
cd /Users/iorran/pgt && npm test --workspace=@pgt/api
```

Expected: all tests green, including the four new `seed-guide.test.ts` tests.

- [ ] **Step 4: Hand off to user**

Announce:

> Phase 3 complete. Final verification passed:
> - Both guides rewritten with audit findings + screenshots.
> - Wikilinks converted to GitHub-compatible relative links.
> - README links to both guides.
> - Audit scaffold deleted.
> - `seed-guide` unit tests pass.
>
> Please open both guides on GitHub (via PR preview) and confirm rendering. If anything looks wrong, let me know and I'll iterate.
