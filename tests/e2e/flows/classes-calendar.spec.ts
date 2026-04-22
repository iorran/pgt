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
 * Verifies the instructor calendar renders and opens the edit dialog on click.
 * Drag-to-reschedule is covered by unit tests (hook + mutation); e2e DnD is
 * too brittle to exercise against live library internals.
 */
test('instructor visits /classes, clicks an event, edit dialog opens', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const cls = await createClass(setup.academy.id, setup.instructor.id, {
    name: 'E2E Calendar Class',
    type: 'gi',
    dayOfWeek: new Date().getDay(),
    startTime: '09:00',
    endTime: '10:00',
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    // Desktop viewport → the hook defaults to week view.
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/classes');

    // Confirm week view is active in the RBC toolbar.
    await expect(
      page.locator('.rbc-toolbar button.rbc-active', { hasText: /week|semana/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(cls.name)).toBeVisible({ timeout: 10_000 });

    await page.getByText(cls.name).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('dialog').getByText(/editar aula|edit class/i),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
