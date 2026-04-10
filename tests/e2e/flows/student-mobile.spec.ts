import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
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

test('student sees bottom nav with all five tab routes', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(academy.id, { name: 'E2E Mobile Student' });

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: /student bottom navigation/i });
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // Assert that every tab is wired to the correct route. We don't
    // click through all four tabs because better-auth's session hook
    // transiently flaps to null on refetch, and App.tsx redirects to
    // /login during that window — a pre-existing app bug that's out
    // of scope for this branch. Asserting on hrefs verifies the
    // shell's contract without depending on that timing.
    await expect(nav.locator('a[href="/classes"]')).toBeVisible();
    await expect(nav.locator('a[href="/gamification/profile"]')).toBeVisible();
    await expect(nav.locator('a[href="/checkin"]')).toBeVisible();
    await expect(nav.locator('a[href="/marketplace"]')).toBeVisible();
    await expect(nav.locator('a[href="/me"]')).toBeVisible();

    // Click through to /me — the one route this branch introduces —
    // to prove the NavLink actually navigates.
    await nav.locator('a[href="/me"]').click();
    await expect(page).toHaveURL(/\/me$/);
  } finally {
    await context.close();
  }
});

test('FAB navigates to fullscreen check-in without the shell', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(academy.id, { name: 'E2E FAB Student' });

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page
      .getByRole('navigation', { name: /student bottom navigation/i })
      .locator('a[href="/checkin"]')
      .click();
    await expect(page).toHaveURL(/\/checkin/);
    await expect(
      page.getByRole('navigation', { name: /student bottom navigation/i }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('instructor does NOT see the student bottom nav', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: /student bottom navigation/i }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
