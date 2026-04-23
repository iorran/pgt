import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  e2eDb,
  schema,
  type FixtureAcademy,
  type FixtureUser,
  type FixtureClass,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { OwnerDashboardPage } from '../pages/owner-dashboard-page';

/**
 * Promote the instructor returned by setupAcademy() into an owner so the
 * requireOwner middleware accepts them on /api/owner/*. setupAcademy already
 * sets academy.ownerId to the instructor — we just need to flip the role.
 */
async function makeOwner(academyId: string, userId: string) {
  await e2eDb
    .update(schema.user)
    .set({ role: 'owner' })
    .where(eq(schema.user.id, userId));
  // Defensive: ensure ownerId matches even if fixtures change.
  await e2eDb
    .update(schema.academy)
    .set({ ownerId: userId })
    .where(eq(schema.academy.id, academyId));
}

async function seedStudent(
  academyId: string,
  name: string,
): Promise<FixtureUser> {
  const token = crypto.randomBytes(4).toString('hex');
  const [u] = await e2eDb
    .insert(schema.user)
    .values({
      academyId,
      email: `owner-dash-student-${token}@e2e.pgt`,
      name,
      role: 'student',
      belt: 'white',
      status: 'active',
      dateOfBirth: '1995-01-01',
    })
    .returning();
  return u;
}

async function seedClass(
  academyId: string,
  instructorId: string,
  name: string,
): Promise<FixtureClass> {
  const [c] = await e2eDb
    .insert(schema.bjjClass)
    .values({
      academyId,
      instructorId,
      name,
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '19:00',
      endTime: '20:00',
      active: true,
    })
    .returning();
  return c;
}

async function seedCheckin(
  classId: string,
  studentId: string,
  checkedInAt: Date,
) {
  await e2eDb.insert(schema.checkin).values({
    classId,
    studentId,
    source: 'button',
    checkedInAt,
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  // Middle of the day to avoid DST edge cases.
  d.setHours(12, 0, 0, 0);
  return d;
}

test.describe('owner dashboard', () => {
  let academy: FixtureAcademy | undefined;

  test.afterEach(async () => {
    if (academy) {
      await cleanAcademy(academy.id);
      academy = undefined;
    }
  });

  test('owner sees chart, class row expansion, and student row expansion', async ({
    browser,
  }) => {
    const setup = await setupAcademy();
    academy = setup.academy;
    const owner = setup.instructor;
    await makeOwner(academy.id, owner.id);

    const className = `E2E Gi Owner ${crypto.randomBytes(3).toString('hex')}`;
    const cls = await seedClass(academy.id, owner.id, className);

    const studentA = await seedStudent(academy.id, 'Aderencia Alice');
    const studentB = await seedStudent(academy.id, 'Aderencia Bob');
    const studentC = await seedStudent(academy.id, 'Aderencia Carla');

    // Spread check-ins across the last few days so the current-week window
    // captures multiple occurrences and the chart has non-empty data.
    await seedCheckin(cls.id, studentA.id, daysAgo(0));
    await seedCheckin(cls.id, studentB.id, daysAgo(0));
    await seedCheckin(cls.id, studentA.id, daysAgo(1));
    await seedCheckin(cls.id, studentC.id, daysAgo(2));
    await seedCheckin(cls.id, studentB.id, daysAgo(3));

    const context = await impersonateAs(browser, owner.email);
    try {
      const page = await context.newPage();
      const dash = new OwnerDashboardPage(page);
      await dash.goto();

      await expect(dash.heading()).toBeVisible({ timeout: 10_000 });

      // Chart section renders with the class name as an x-axis label.
      // Using getByText on the class name (it only appears once on the
      // page prior to expanding rows: inside the chart + the class row,
      // but recharts tick labels are <text>, not accessible buttons).
      await expect(page.locator('[data-testid="aderencia-chart"]')).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(className).first()).toBeVisible();

      // Students list renders — match the student's name as a row.
      // Using getByText avoids matching the status chip buttons.
      await expect(page.getByText('Aderencia Alice', { exact: true })).toBeVisible();

      // Click the class row to expand. Its accessible name contains the
      // class name plus the totals/trend — a regex on the class name
      // is unique enough.
      await dash.classRow(new RegExp(className, 'i')).first().click();
      // Roster heading appears in the expansion.
      await expect(page.getByText(/roster/i)).toBeVisible({ timeout: 10_000 });

      // Toggle a status chip — click "Slowing". The All chip is default.
      // Matching /^slowing/i targets the chip (label starts with "Slowing").
      await dash.statusChip(/^slowing\b/i).click();
      // Clicking a filter shouldn't navigate; the students section still
      // has the "Students" header and the heading stays visible.
      await expect(dash.heading()).toBeVisible();

      // Re-select "All" so Alice is visible again for the next step.
      await dash.statusChip(/^all\b/i).click();

      // Click the student row to expand. The accessible name contains
      // "Aderencia Alice" — narrower than any chip.
      await dash.studentRow(/aderencia alice/i).click();
      // The expansion shows stats — "Streak:" or "Total:" appears.
      await expect(page.getByText(/streak:/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/total:/i)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('non-owner (student) hitting /owner/dashboard sees 403', async ({
    browser,
  }) => {
    const setup = await setupAcademy();
    academy = setup.academy;
    const student = await seedStudent(academy.id, 'E2E Blocked Student');

    const context = await impersonateAs(browser, student.email);
    try {
      const page = await context.newPage();
      const dash = new OwnerDashboardPage(page);
      await dash.goto();

      await expect(dash.forbiddenNotice()).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('owner dashboard entry card on /dashboard navigates to /owner/dashboard', async ({
    browser,
  }) => {
    const setup = await setupAcademy();
    academy = setup.academy;
    const owner = setup.instructor;
    await makeOwner(academy.id, owner.id);

    const context = await impersonateAs(browser, owner.email);
    try {
      const page = await context.newPage();
      await page.goto('/dashboard');

      // The entry card renders "Academy dashboard" as its CardTitle.
      const card = page.getByText(/academy dashboard/i).first();
      await expect(card).toBeVisible({ timeout: 10_000 });

      await card.click();
      await expect(page).toHaveURL(/\/owner\/dashboard/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
