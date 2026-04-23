import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  scenarioStudentWithOverdueBilling,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { DashboardPage } from '../pages/dashboard-page';
import { BillingPage } from '../pages/billing-page';
import { eq } from 'drizzle-orm';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

test('26. language toggle PT ↔ EN persists across navigation', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.goto('/');
    const dashboard = new DashboardPage(page);
    await expect(dashboard.sidebarStudents).toBeVisible({ timeout: 10_000 });

    // Click the EN language toggle button in the header
    await page.getByRole('button', { name: /^en$/i }).click();

    // The sidebar label should change from "Alunos" to "Students"
    await expect(
      page.getByRole('link', { name: /^students$/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to billing via the sidebar (now labeled "Billing" in EN)
    await page.getByRole('link', { name: /^billing$/i }).click();
    await expect(page).toHaveURL(/\/billing/);

    // The billing page overdue tab should appear in English
    await expect(
      page.getByRole('link', { name: /overdue|defaulters/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Switch back to PT — sidebar should revert
    await page.getByRole('button', { name: /^pt$/i }).click();
    await expect(
      page.getByRole('link', { name: /^alunos$/i }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('27. student with multi-month overdue sees banner and navigates to billing', async ({
  browser,
}) => {
  const setup = await scenarioStudentWithOverdueBilling();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.student.email);
  try {
    const page = await context.newPage();
    await page.goto('/');
    // Students are redirected from "/" to their home (/classes) by App.tsx;
    // the overdue banner is rendered in the StudentShell above the outlet so
    // it's visible on whichever student page they land on.
    await expect(page).toHaveURL(/\/classes/, { timeout: 10_000 });

    // The overdue banner is a plain div (not role=alert) with destructive styles
    const overdueBanner = page.locator('.bg-destructive\\/10').first();
    await expect(overdueBanner).toBeVisible({ timeout: 10_000 });

    // The banner text mentions how many days overdue
    await expect(overdueBanner).toContainText(/atras|overdue/i);

    // Students don't have billing in the sidebar — navigate directly
    await page.goto('/billing');
    await expect(page).toHaveURL(/\/billing/, { timeout: 10_000 });

    // The billing page should load (overdue tab visible — students can see their own billing)
    const billingPage = new BillingPage(page);
    await expect(billingPage.overdueTab).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('28. instructor notification bell shows overdue count and dropdown actions', async ({
  browser,
}) => {
  const setup = await scenarioStudentWithOverdueBilling();
  academy = setup.academy;

  // Give the overdue student a phone number so the WhatsApp action appears
  await e2eDb
    .update(schema.user)
    .set({ phone: '5511999999999' })
    .where(eq(schema.user.id, setup.student.id));

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.goto('/');

    // Wait for page to load
    await expect(page.getByRole('link', { name: /^alunos$/i })).toBeVisible({
      timeout: 10_000,
    });

    // The bell button has aria-label from t('notifications.title') = "Notificações"
    // in pt-BR. The impersonateAs uses locale pt-BR.
    const bellButton = page.getByRole('button', {
      name: /notif/i,
    });
    await expect(bellButton).toBeVisible({ timeout: 10_000 });

    // Bell badge should show count > 0
    const badge = bellButton.locator('span').filter({ hasText: /^\d+$/ });
    await expect(badge).toBeVisible();

    // Click to open the dropdown
    await bellButton.click();

    // Dropdown shows the overdue student by name
    await expect(page.getByText(setup.student.name, { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    // WhatsApp / Send reminder button should be visible (student has phone)
    await expect(
      page.getByRole('button', { name: /lembrete|reminder/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Send email button should be visible
    await expect(
      page.getByRole('button', { name: /e-mail|email/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Mute button (BellOff icon) should be visible — it's icon-only, ghost variant
    // It's in the same flex row as the WhatsApp and email buttons
    // Use the notification dropdown container to scope the lookup
    const dropdown = page.locator('.w-80');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
    // The mute button is the last button in the actions row; there are 3 buttons per student entry
    const actionButtons = dropdown.getByRole('button');
    // At least 3 action buttons should be present (WhatsApp, Email, Mute)
    await expect(actionButtons.nth(0)).toBeVisible();
    await expect(actionButtons.nth(1)).toBeVisible();
    await expect(actionButtons.nth(2)).toBeVisible();
  } finally {
    await context.close();
  }
});
