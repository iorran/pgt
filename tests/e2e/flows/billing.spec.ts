import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  createPlan,
  assignMembership,
  scenarioStudentWithOverdueBilling,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { BillingPage, PlansPage, PaymentsPage } from '../pages/billing-page';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

test('12. billing overdue tab shows overdue students', async ({ browser }) => {
  const setup = await scenarioStudentWithOverdueBilling();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const billing = new BillingPage(page);
    await billing.goto();

    await expect(billing.studentCard(setup.student.name)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});

test('13. instructor creates a new membership plan', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const plans = new PlansPage(page);
    await plans.goto();
    await plans.createPlanButton.click();

    const planName = `E2E Plan ${Date.now()}`;
    await plans.planNameInput.fill(planName);
    await plans.priceInput.fill('150.00');
    await plans.frequencySelect.selectOption('monthly');
    // classesPerWeek is required — fill in the number field
    await page.locator('input[type="number"]').last().fill('3');
    await plans.saveButton.click();

    await expect(plans.planCard(planName)).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('14. instructor edits an existing plan', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const plan = await createPlan(setup.academy.id, {
    name: 'E2E Plan To Edit',
    price: '100.00',
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const plans = new PlansPage(page);
    await plans.goto();

    const card = plans.planCard(plan.name);
    // t('common.edit') = "Editar"
    await card.getByRole('button', { name: /^editar$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill required classesPerWeek (null in fixture → empty → browser validation error)
    // classesPerWeek is the last number input; price has step="0.01"
    await dialog.locator('input[type="number"]').last().fill('3');
    await plans.priceInput.fill('200.00');
    await plans.saveButton.click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(card.getByText(/200/)).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

test('15. instructor records a manual payment', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const plan = await createPlan(setup.academy.id);
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Payment Recipient',
  });
  await assignMembership(student.id, plan.id);

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const payments = new PaymentsPage(page);
    await payments.goto();

    // Select student from native <select>
    await payments.studentSelect.selectOption({ label: student.name });

    await payments.amountInput.fill('180.00');
    const today = new Date().toISOString().slice(0, 10);
    await payments.dateInput.fill(today);
    await payments.referenceMonthInput.fill(today.slice(0, 7));
    await payments.recordButton.click();

    // After save, the payment table should show a row with the amount
    // The GET /payments endpoint does not join user names, so studentName
    // renders as "-". Assert by the amount value instead.
    await expect(
      page.getByRole('cell', { name: /180/ }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});
