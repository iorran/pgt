---
title: Playwright E2E Tests
date: 2026-04-09
status: draft
---

# Playwright E2E Tests

## Context

The PGT BJJ academy management app has unit tests (167 passing on the API,
114 on the web) plus a Playwright-driven screenshot capture pipeline that
already drives the app end-to-end for documentation purposes. What's missing
is an actual end-to-end test suite that asserts user-facing flows work
correctly against real dev or production-built artifacts.

The recently shipped `dev-auth-bypass` endpoint (`apps/api/src/routes/dev.ts`)
and the `seed-guide` fixture (`apps/api/src/db/seed-guide.ts`) are the
foundation we'll reuse: impersonation is already solved for cookie-based
BetterAuth sessions, and the factory pattern in `apps/api/test/helpers.ts`
maps directly onto what e2e tests need for per-test setup.

This spec plans the first iteration of e2e coverage: 28 tests covering
happy paths plus critical error paths across every documented flow.

## Goals

- 28 Playwright tests covering the user-facing flows documented in both
  guides: auth and onboarding, student management, billing, classes and
  check-ins, marketplace, tournaments and gamification, and cross-cutting
  concerns (language toggle, overdue banner, notification bell).
- Per-test database isolation: each test creates an ephemeral academy and
  tears it down after, so tests never bleed into each other and can be
  developed in parallel by multiple people without coordinating fixtures.
- Dual execution targets: local dev servers for fast iteration, a
  production-style `vite build` + `vite preview` + built API for CI.
- Reuse of existing primitives: `/api/dev/impersonate` for auth,
  `apps/api/test/helpers.ts` factory pattern for DB setup,
  `@playwright/test` already installed as a root devDependency.
- Zero flakes at merge. Any flake that slips in becomes a follow-up ticket.
- CI workflow that runs the suite on every PR and uploads Playwright traces
  + screenshots on failure.

## Non-Goals

- No real production smoke tests against `pgt-api.fly.dev`. Deferred.
- No visual regression testing. The screenshot capture pipeline serves a
  different purpose and should not be conflated with e2e assertions.
- No load or performance testing.
- No multi-browser matrix. Chromium only for the first iteration. WebKit
  and Firefox can be added later if product reach requires it.
- No tests for the `/totem` kiosk page. Kiosk state is hard to exercise
  without a real totem and the screenshot pipeline already covers it.
- No tests for `/checkin` QR redemption. The flow requires a real token
  produced by a totem scan; it is described in text in the student guide.
- No real email delivery, real WhatsApp links, or real geolocation.
  All three are mocked at the Playwright browser context level.
- No refactoring of existing page components to add testids unless a flow
  is genuinely unreachable by role-based selectors.

## Architecture

### File layout

```
tests/e2e/
├── playwright.config.ts          Multi-target config (local | ci)
├── fixtures.ts                   Drizzle-direct setup helpers
├── auth.ts                       impersonateAs() wrapping /api/dev/impersonate
├── pages/                        Page object model, one file per screen
│   ├── login-page.ts
│   ├── dashboard-page.ts
│   ├── students-page.ts
│   ├── student-detail-page.ts
│   ├── billing-page.ts
│   ├── plans-page.ts
│   ├── classes-page.ts
│   ├── marketplace-page.ts
│   ├── tournaments-page.ts
│   └── gamification-page.ts
├── flows/                        Actual *.spec.ts files grouped by journey
│   ├── auth.spec.ts              Tests 1-6
│   ├── student-management.spec.ts Tests 7-11
│   ├── billing.spec.ts           Tests 12-15
│   ├── classes.spec.ts           Tests 16-19
│   ├── marketplace.spec.ts       Tests 20-22
│   ├── tournaments.spec.ts       Tests 23-25
│   └── cross-cutting.spec.ts     Tests 26-28
└── README.md                     How to run, how to add a new test
```

### Configuration strategy

`tests/e2e/playwright.config.ts` exports a single `defineConfig` that
branches on `process.env.TEST_TARGET`:

- `TEST_TARGET=local` (default): start dev servers via `webServer`,
  reuse existing servers if already running, run against
  `http://localhost:5173` (web) and `http://localhost:3000` (API).
- `TEST_TARGET=ci`: build both apps, start them from the build artifacts,
  do not reuse existing servers.

Both targets set `DEV_AUTH_BYPASS=1` and `NODE_ENV=development` on the API
process so `/api/dev/impersonate` is active. The endpoint's double-gate
(`NODE_ENV === 'development'` AND `DEV_AUTH_BYPASS === '1'`) means it
remains hardcoded to 404 in actual production deployments, which set
`NODE_ENV=production`.

Key config values:
- `fullyParallel: false` — the suite shares one local Postgres, so tests
  run sequentially. Per-test DB isolation via unique academy slugs
  prevents cross-test pollution.
- `workers: 1` in CI, `workers: 2` locally — local machines have more
  headroom and per-test isolation is safe under low concurrency.
- `use.locale = 'pt-BR'`, `use.timezoneId = 'Europe/Lisbon'` — the app's
  canonical locale. English is exercised only by the cross-cutting
  language-toggle test (test 26).
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` — keeps
  artifacts small while giving full context on failures.
- `baseURL: 'http://localhost:5173'` — page objects use relative paths.

### Auth strategy

Reuse `/api/dev/impersonate`. Tests never fill the login form unless the
test is specifically about the login flow itself (tests 1 and 6).

```ts
// auth.ts (sketch)
export async function impersonateAs(
  browser: Browser,
  email: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
  });
  const page = await context.newPage();
  const response = await page.goto(
    `/api/dev/impersonate?email=${encodeURIComponent(email)}`,
  );
  if (!response?.ok()) {
    throw new Error(`impersonate failed for ${email}`);
  }
  await page.close();
  return context;
}
```

The `page.goto` hits `http://localhost:5173/api/dev/impersonate` which is
proxied by Vite to the API at `:3000`. The signed session cookie is set
on `localhost:5173`, the same origin the web app later fetches
`/api/auth/get-session` from, so BetterAuth recognizes the session on
every subsequent request.

### Data strategy — `fixtures.ts`

Each test runs this shape:

1. **Arrange (fast, backdoor)**: call `setupAcademy()` and related helpers
   to insert academy + users + plans + memberships directly via Drizzle.
   Each test gets a unique academy slug like `e2e-${testInfo.title.slug}-${randomId}`
   so tests never collide with each other or with seeded data.
2. **Act (UI)**: drive the browser via Playwright to perform the actual
   behavior under test — fill forms, click buttons, navigate pages.
3. **Assert (UI)**: verify the expected state in the UI (visible text,
   navigation destination, toast messages).
4. **Teardown**: `cleanAcademy(academyId)` removes the academy and all
   dependent rows (payments, memberships, classes, users, sessions).

Helper API (exported from `tests/e2e/fixtures.ts`):

```ts
export async function setupAcademy(
  overrides?: Partial<NewAcademy>,
): Promise<{ academy: Academy; instructor: User }>;

export async function createStudent(
  academyId: string,
  overrides?: Partial<NewUser>,
): Promise<User>;

export async function createPlan(
  academyId: string,
  overrides?: Partial<NewMembershipPlan>,
): Promise<MembershipPlan>;

export async function assignMembership(
  studentId: string,
  planId: string,
  overrides?: Partial<NewStudentMembership>,
): Promise<StudentMembership>;

export async function createPayment(
  studentId: string,
  academyId: string,
  instructorId: string,
  overrides?: Partial<NewPayment>,
): Promise<Payment>;

export async function createClass(
  academyId: string,
  instructorId: string,
  overrides?: Partial<NewBjjClass>,
): Promise<BjjClass>;

export async function cleanAcademy(academyId: string): Promise<void>;

// Pre-bundled scenarios for common setups
export async function scenarioInstructorWithStudents(opts?: {
  studentCount?: number;
  withPendingStudent?: boolean;
  withOverdueStudent?: boolean;
}): Promise<{ academy; instructor; students; plan }>;

export async function scenarioStudentWithOverdueBilling(): Promise<{
  academy;
  student;
  plan;
}>;
```

All helpers use the repo's existing `apps/api/test/helpers.ts` pattern
(direct Drizzle inserts with timestamp-based unique ids) as a reference
implementation. They do NOT inherit from it — e2e tests are a separate
workspace and cannot reach into `apps/api/test` without creating a
dependency tangle.

### Page object model

One `tests/e2e/pages/*.ts` file per major screen. Each exposes:

- `goto()` — navigation helper
- Locator getters returning Playwright `Locator` objects, always by role +
  accessible name in pt-BR as the primary strategy
- High-level action methods (`await dashboard.openBillingFromBanner()`)

Example sketch for `students-page.ts`:

```ts
export class StudentsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/students');
  }

  get pendingTab() {
    return this.page.getByRole('tab', { name: /pendentes/i });
  }

  get studentRows() {
    return this.page.getByRole('row');
  }

  async approveStudent(name: string) {
    await this.pendingTab.click();
    const row = this.page.getByRole('row', { name: new RegExp(name, 'i') });
    await row.getByRole('button', { name: /aprovar/i }).click();
  }
}
```

Fall back to `data-testid` only when role-based selectors cannot
disambiguate. Adding test ids to a component is a last resort and each
addition must be justified in the PR description.

### CI workflow

New file: `.github/workflows/e2e.yml`

- **Triggers**: `pull_request` (all branches), `workflow_dispatch`.
- **Concurrency**: group by PR, cancel in-progress runs on new pushes.
- **Services**: `postgres:16-alpine` on port 5432 with `POSTGRES_USER=postgres`,
  `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=pgt`, healthcheck polling
  `pg_isready`.
- **Steps**:
  1. Checkout
  2. Setup Node 20
  3. `npm ci`
  4. `npm run db:migrate` against the service Postgres
  5. `npx playwright install --with-deps chromium`
  6. Build API and web (`npm run build`)
  7. `TEST_TARGET=ci npx playwright test --config tests/e2e/playwright.config.ts`
  8. On failure: upload `test-results/` and `playwright-report/` as
     artifacts for 7 days.
- **Environment variables** passed to the Playwright run:
  - `DATABASE_URL` pointing at the service Postgres
  - `BETTER_AUTH_SECRET` from a GitHub Actions secret
  - `DEV_AUTH_BYPASS=1`
  - `NODE_ENV=development`

### Mocking strategy

- **Geolocation**: `context.grantPermissions(['geolocation'])` +
  `context.setGeolocation({ latitude, longitude })` inside the check-in
  test setup. The academy fixture sets matching coordinates so proximity
  checks pass.
- **Email**: never verified. Password reset test asserts the "check your
  email" screen is reached, then stops. No actual email is read.
- **WhatsApp**: notification bell test asserts the `wa.me/...` href is
  present and well-formed. Does not click through.
- **Time**: `Date.now()` is not mocked. Tests that depend on time ranges
  (e.g., billing overdue days) create rows with offsets from the current
  `Date.now()` during setup, the same way `seed-guide.ts` does it.

## Test list (28 tests, grouped by file)

### `flows/auth.spec.ts` — 6 tests

1. Unauthenticated visit to `/` redirects to `/login`.
2. Student signup with valid join code → `/aguardando` screen shown.
3. Instructor signup and create academy → dashboard renders with join code.
4. `/entrar/:code` with an invalid code shows "academia não encontrada".
5. Forgot-password form submission reaches the confirmation screen.
6. Login with wrong password shows an inline error without navigating.

### `flows/student-management.spec.ts` — 5 tests

7. Instructor approves a pending student; student moves from Pendentes
   tab to Alunos tab.
8. Instructor rejects a pending student; student disappears from both
   tabs (or lands in a rejected state, depending on current behavior).
9. Instructor opens student detail and assigns a plan via the dialog.
10. Instructor opens student detail and uses "Pagar Mês Atual" quick-pay
    button to record a current-month payment.
11. Students list search filters by name.

### `flows/billing.spec.ts` — 4 tests

12. Billing Inadimplentes tab lists all overdue students sorted by days
    overdue descending.
13. Instructor creates a new membership plan via the Planos tab form.
14. Instructor edits an existing plan and saves.
15. Instructor records a manual payment via the Pagamentos tab form.

### `flows/classes.spec.ts` — 4 tests

16. Instructor creates a class with day-of-week and start/end times.
17. Instructor edits an existing class (e.g., change start time).
18. Student taps the Check-in button on the Aulas page; geolocation is
    granted via Playwright; success toast appears.
19. Instructor views check-in history for a class and sees the student
    from test 18 (set up via fixture, not ordering dependency).

### `flows/marketplace.spec.ts` — 3 tests

20. Instructor adds a product with name, description, price, and stock.
21. Student requests a product from the marketplace, creating an order
    in "pendente" state.
22. Instructor confirms the order, then marks it as delivered.

### `flows/tournaments.spec.ts` — 3 tests

23. Instructor creates a tournament with name, date, location.
24. Student signs up for the tournament from the tournaments page.
25. Student submits a competition result (via a form), then instructor
    approves it on the gamification results page.

### `flows/cross-cutting.spec.ts` — 3 tests

26. Language toggle PT↔EN persists across navigation. Switch to EN on
    the dashboard, navigate to students, confirm labels are still EN.
27. Student with multi-month overdue billing sees the red banner on the
    dashboard and can click through to the billing page.
28. Instructor notification bell shows the overdue count badge and the
    dropdown exposes WhatsApp + email + mute actions for each overdue
    student.

## Testing strategy (meta)

This is a test suite; there is no "test the tests" layer. Validation is:

1. Every test passes against a clean local dev stack on the author's
   machine before merge.
2. Every test passes in CI against the built artifacts (required check).
3. Flake budget: 0 known flakes at merge time. A test that fails
   intermittently MUST be investigated before merge, not retried.
4. Per-test isolation is verified by running the suite twice in a row;
   results must match.

## Deliverables

1. `tests/e2e/playwright.config.ts`
2. `tests/e2e/fixtures.ts`
3. `tests/e2e/auth.ts`
4. `tests/e2e/pages/*.ts` (10 page objects)
5. `tests/e2e/flows/*.spec.ts` (7 spec files, 28 tests total)
6. `tests/e2e/README.md`
7. `.github/workflows/e2e.yml`
8. Root `package.json` — new scripts:
   - `test:e2e` — `playwright test --config tests/e2e/playwright.config.ts`
   - `test:e2e:ui` — `playwright test --config tests/e2e/playwright.config.ts --ui`
   - `test:e2e:ci` — `TEST_TARGET=ci playwright test --config tests/e2e/playwright.config.ts`

## Open Risks

- **Sequential execution slows the suite**: ~28 tests × 3-5s each ≈
  90-140 seconds. Acceptable for a first iteration. If the suite grows
  past 100 tests, revisit with namespaced parallel workers (one DB per
  worker, each with its own schema).

- **Geolocation probing in components**: if any component calls
  `navigator.permissions.query({ name: 'geolocation' })` in a way that
  Playwright's `grantPermissions` does not satisfy, test 18 will hang.
  Mitigation: write test 18 first, fix component behavior if needed
  before writing the rest.

- **BetterAuth session table pollution**: each `impersonateAs` call
  inserts a session row. Over many test runs these accumulate.
  Mitigation: `cleanAcademy` deletes sessions by joining through users.

- **Dev auth bypass in CI**: CI sets `NODE_ENV=development` even though
  it is a CI runner. This is intentional so the impersonate endpoint is
  active. Production deployments on Fly.io set `NODE_ENV=production`
  and the endpoint's double-gate ensures it remains 404-locked there.
  Documented in `tests/e2e/README.md` and in a comment in the workflow
  file so nobody "fixes" it by setting `NODE_ENV=production` in CI.

- **Reuse-existing-server behavior**: `reuseExistingServer: true` in
  local mode means re-running the suite against servers started by
  hand is fast. But if the servers were started WITHOUT
  `DEV_AUTH_BYPASS=1`, tests will fail with 404 on impersonate.
  Mitigation: `tests/e2e/README.md` explicitly documents the command
  to start servers, and the impersonate helper's failure message points
  at the env var.

- **Page object drift as the UI evolves**: page objects duplicate some
  knowledge with the production code. Mitigation: drift detection
  workflow (already shipped via Task A) warns on guide drift; a similar
  hook can be added for page-object drift in a follow-up if needed.

## Out of scope (follow-up specs)

- Production smoke tests against `pgt-api.fly.dev`
- Visual regression testing
- Mobile browser matrix
- Performance / load testing
- Multi-language exhaustive coverage
- Tests for `/totem` kiosk and `/checkin` QR redemption
