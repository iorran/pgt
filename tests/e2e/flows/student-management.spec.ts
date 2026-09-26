import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  assignMembership,
  scenarioInstructorWithPendingStudent,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import {
  StudentsPage,
  PendingStudentsPage,
  StudentDetailPage,
} from '../pages/students-page';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

test('7. instructor approves a pending student', async ({ browser }) => {
  const { academy: acad, instructor, pendingStudent } =
    await scenarioInstructorWithPendingStudent();
  academy = acad;

  const context = await impersonateAs(browser, instructor.email);
  try {
    const page = await context.newPage();
    const pending = new PendingStudentsPage(page);
    await pending.goto();

    // Student card should be visible
    await expect(pending.card(pendingStudent.name)).toBeVisible({ timeout: 10_000 });

    await pending.approve(pendingStudent.name);

    // After approval, card should disappear from Pendentes.
    await expect(pending.card(pendingStudent.name)).toHaveCount(0, {
      timeout: 10_000,
    });

    // And appear in the active Alunos list.
    const students = new StudentsPage(page);
    await students.goto();
    await expect(students.row(pendingStudent.name)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('8. instructor rejects a pending student', async ({ browser }) => {
  const { academy: acad, instructor, pendingStudent } =
    await scenarioInstructorWithPendingStudent();
  academy = acad;

  const context = await impersonateAs(browser, instructor.email);
  try {
    const page = await context.newPage();
    const pending = new PendingStudentsPage(page);
    await pending.goto();

    await expect(pending.card(pendingStudent.name)).toBeVisible({ timeout: 10_000 });

    await pending.reject(pendingStudent.name);

    await expect(pending.card(pendingStudent.name)).toHaveCount(0, {
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});

test('10. instructor uses "Pagar Mês Atual" quick-pay', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Quick Pay Student',
  });
  await assignMembership(student.id);

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const detail = new StudentDetailPage(page);
    await detail.goto(student.id);

    await expect(detail.payCurrentMonthButton).toBeVisible({ timeout: 10_000 });

    await detail.payCurrentMonth();

    // After quick-pay, the payment history shows one row at the student's
    // Monthly Fee (assignMembership sets 180.00).
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator('tbody tr')).toContainText(/180,00\s*€/);
  } finally {
    await context.close();
  }
});

test('11. students list search filters by name', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  await createStudent(setup.academy.id, { name: 'E2E Alice' });
  await createStudent(setup.academy.id, { name: 'E2E Bob' });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const students = new StudentsPage(page);
    await students.goto();

    await expect(students.row('E2E Alice')).toBeVisible();
    await expect(students.row('E2E Bob')).toBeVisible();

    await students.searchInput.fill('Alice');
    await expect(students.row('E2E Alice')).toBeVisible();
    await expect(students.row('E2E Bob')).toHaveCount(0, { timeout: 5_000 });
  } finally {
    await context.close();
  }
});
