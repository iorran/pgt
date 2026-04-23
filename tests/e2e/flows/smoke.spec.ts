import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  type FixtureAcademy,
  type FixtureUser,
} from '../fixtures';
import { impersonateAs } from '../auth';

test.describe('smoke', () => {
  let academy: FixtureAcademy;
  let instructor: FixtureUser;

  test.beforeEach(async () => {
    const setup = await setupAcademy();
    academy = setup.academy;
    instructor = setup.instructor;
  });

  test.afterEach(async () => {
    if (academy) await cleanAcademy(academy.id);
  });

  test('impersonates an instructor and loads the dashboard', async ({
    browser,
  }) => {
    const context = await impersonateAs(browser, instructor.email);
    try {
      const page = await context.newPage();
      await page.goto('/');
      await expect(page).toHaveURL(/\/$|\/dashboard/);
      // The dashboard renders the greeting "Olá, {name}" for the logged-in
      // user. The instructor name is deterministic from setupAcademy().
      // Scope to the dashboard greeting to avoid the sidebar user-card
      // duplicate; "Olá," is the pt-BR `dashboard.greeting` prefix.
      await expect(
        page.getByText(new RegExp(`Olá,\\s*${instructor.name}`, 'i')),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
