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

  test('impersonates the owner and loads the academy dashboard', async ({
    browser,
  }) => {
    const context = await impersonateAs(browser, instructor.email);
    try {
      const page = await context.newPage();
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      // Owners land on "Painel da Academia" (the owner dashboard).
      await expect(
        page.getByRole('heading', { name: /painel da academia/i }),
      ).toBeVisible({ timeout: 10_000 });
      // The header shows the logged-in owner's name.
      await expect(page.getByRole('banner')).toContainText(instructor.name);
    } finally {
      await context.close();
    }
  });
});
