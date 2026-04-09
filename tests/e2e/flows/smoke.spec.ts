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
      // The dashboard renders the academy name in the main card.
      await expect(page.getByText(academy.name, { exact: false })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await context.close();
    }
  });
});
