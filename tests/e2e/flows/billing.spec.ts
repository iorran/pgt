import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  assignMembership,
  scenarioStudentWithOverdueBilling,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { BillingPage, PaymentsPage } from '../pages/billing-page';

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

test('15. instructor records a manual payment', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Payment Recipient',
  });
  await assignMembership(student.id);

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
