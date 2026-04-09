# E2E Tests

Playwright end-to-end tests for the PGT BJJ academy management app.

## Running locally

### Prerequisites

1. Docker Postgres running: `docker-compose up -d`
2. Migrations applied: `npm run db:migrate`
3. `@playwright/test` browsers installed: `npx playwright install chromium`
4. API dev server with auth bypass enabled:
   ```bash
   DEV_AUTH_BYPASS=1 NODE_ENV=development npm run dev --workspace=@pgt/api
   ```
5. Web dev server: `npm run dev --workspace=@pgt/web`

Playwright's `webServer` config can start these for you automatically on the
first run — the `reuseExistingServer: true` flag will skip the spin-up if
they're already running on the expected ports.

### Commands

```bash
# Run all e2e tests (local target)
npm run test:e2e

# Run a single spec
npm run test:e2e -- auth

# Run a single test by grep
npm run test:e2e -- --grep "approves"

# Playwright UI mode (interactive debugging)
npm run test:e2e:ui

# Simulate CI target (build artifacts, no dev server reuse)
npm run test:e2e:ci
```

## Architecture

- `playwright.config.ts` — multi-target config. `TEST_TARGET=local` uses dev
  servers; `TEST_TARGET=ci` uses built artifacts.
- `auth.ts` — `impersonateAs(browser, email)` creates a browser context with
  a valid BetterAuth session cookie by calling `/api/dev/impersonate`.
- `fixtures.ts` — Drizzle-direct helpers for per-test data setup and teardown.
  Every test calls `setupAcademy()` (or a scenario helper) in the arrange
  phase and `cleanAcademy()` in `afterEach`.
- `pages/` — page object model. One file per major screen. Selectors use
  accessible role + name whenever possible; fall back to `getByText` or
  `data-testid` only when role-based selectors can't disambiguate.
- `flows/*.spec.ts` — actual tests, one file per user journey.

## Adding a new test

1. Identify which spec file it belongs in (or create a new one if it
   represents a new journey).
2. If a new page object is needed, add it under `pages/` first.
3. Add a fixture helper in `fixtures.ts` if the arrange phase is more than
   2-3 lines or will be reused by multiple tests.
4. Write the test with the shape:
   ```typescript
   test('N. description', async ({ browser }) => {
     const setup = await setupAcademy(); // or a scenario helper
     academy = setup.academy; // for afterEach teardown

     const context = await impersonateAs(browser, setup.instructor.email);
     try {
       const page = await context.newPage();
       // act via page objects
       // assert via expect
     } finally {
       await context.close();
     }
   });
   ```
5. Run the new test in isolation first (`npm run test:e2e -- --grep "N\\."`).
6. Once it passes consistently, run the full suite to confirm no cross-test
   interference.

## Why per-test DB isolation?

Each test creates an ephemeral academy with a unique slug
(`e2e-<rand>-<timestamp>`) so tests can run in any order without touching
each other's data. `cleanAcademy()` in `afterEach` removes the academy and
all dependent rows. This is slower than a shared seed but completely
eliminates flakes caused by test ordering.

## Why is DEV_AUTH_BYPASS active in CI?

The CI workflow sets both `NODE_ENV=development` and `DEV_AUTH_BYPASS=1` so
the `/api/dev/impersonate` endpoint is available to Playwright. This is
intentional: the endpoint is a double-gated mechanism that only activates
when both env vars are set. Production deployments on Fly.io set
`NODE_ENV=production`, which keeps the endpoint 404-locked. Never remove
this double-gate.

## Known quirks

- **Sequential execution** is enforced (`fullyParallel: false`) because the
  suite shares a single Postgres instance. If you see flakes that look like
  race conditions, check whether two tests are using the same email or slug.
- **Selector drift** — when a component's DOM changes, e2e tests may fail.
  Always fix the page object, never the test; the test describes behavior,
  the page object describes DOM.
- **Notification bell selector** is the most fragile in the suite. See
  `apps/web/src/components/notification-bell.tsx` for the current DOM.
