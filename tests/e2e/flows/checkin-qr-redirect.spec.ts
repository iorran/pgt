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
 * Verifies the unauthenticated QR-scan redirect round-trip (Mode A).
 *
 * Flow:
 *   1. Fresh unauthenticated context visits /checkin?token=X&classId=Y
 *   2. App redirects to /login?redirect=%2Fcheckin%3Ftoken%3DX%26classId%3DY
 *   3. After authenticating (via impersonation — fixture users have no
 *      BetterAuth password, so the form cannot be used), the preserved URL
 *      is navigated to directly, confirming the redirect param is correct.
 *
 * NOTE: Fixture users are inserted directly into the DB without going through
 * BetterAuth's signup flow, so they have no password and cannot log in via
 * the email/password form. This test therefore validates the redirect-to-login
 * behaviour and the correctness of the encoded redirect param, then uses the
 * dev impersonation endpoint (DEV_AUTH_BYPASS=1) to complete the round-trip.
 */
test('unauthenticated QR scan redirects to login and preserves the checkin URL', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  await createClass(setup.academy.id, setup.instructor.id, {
    name: 'E2E Redirect Class',
    type: 'gi',
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:30',
  });

  const targetPath = '/checkin?token=fake-token&classId=fake-class-id';
  const encodedRedirect = encodeURIComponent(targetPath);

  // ── Phase 1: unauthenticated redirect ──────────────────────────────────────
  // Fresh, unauthenticated context — no session cookie.
  const unauthContext = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'Europe/Lisbon',
    baseURL: 'http://localhost:5173',
  });

  try {
    const page = await unauthContext.newPage();
    await page.goto(targetPath);

    // Must land on /login with the redirect param fully encoded.
    await expect(page).toHaveURL(
      new RegExp(
        `/login\\?redirect=${encodedRedirect.replace(/[+]/g, '\\+')}`,
      ),
      { timeout: 10_000 },
    );
  } finally {
    await unauthContext.close();
  }

  // ── Phase 2: authenticated context navigates to preserved URL ──────────────
  // Use impersonation (DEV_AUTH_BYPASS=1) since fixture users have no password.
  const authContext = await impersonateAs(browser, setup.instructor.email);

  try {
    const page = await authContext.newPage();
    await page.goto(targetPath);

    // Authenticated users should NOT be redirected to /login.
    // They reach /checkin (may show an error about the fake token, but the
    // URL itself must not change to /login).
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/checkin/, { timeout: 10_000 });
  } finally {
    await authContext.close();
  }
});
