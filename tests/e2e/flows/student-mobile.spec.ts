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

test('student sees bottom nav and can navigate via tabs', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(academy.id, { name: 'E2E Mobile Student' });

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: /student bottom navigation/i });
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // Classes tab
    await nav.getByRole('link', { name: /classes|aulas/i }).first().click();
    await expect(page).toHaveURL(/\/classes$/);

    // Progress tab
    await nav.getByRole('link', { name: /progress|progresso/i }).first().click();
    await expect(page).toHaveURL(/\/gamification\/profile$/);

    // Shop tab
    await nav.getByRole('link', { name: /shop|loja/i }).first().click();
    await expect(page).toHaveURL(/\/marketplace$/);

    // Me tab
    await nav.getByRole('link', { name: /^me$|^perfil$/i }).first().click();
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
      .getByRole('link', { name: /check-in/i })
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
