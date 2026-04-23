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

      // Click the class row to expand. Its accessible name contains the
      // class name plus the totals/trend — a regex on the class name
      // is unique enough.
      await dash.classRow(new RegExp(className, 'i')).first().click();
      // Roster heading appears in the expansion (en: "Roster", pt-BR: "Presentes").
      await expect(page.getByText(/roster|presentes/i).first()).toBeVisible({
        timeout: 10_000,
      });

      // Default students filter is "Drifting" (en) / "Afastando" (pt-BR).
      // Switch to "All"/"Todos" to surface the active students seeded above.
      // The students chip label is `<word> <count>` (e.g. "Todos 3") — the
      // trailing digit disambiguates from the classes type filter's "Todos"
      // chip (no count).
      await dash.statusChip(/^(all|todos)\s+\d+/i).click();

      // Students list renders — find the row button specifically (the
      // expanded class roster above also contains Alice's name in a
      // <li>, so text-based queries collide).
      const aliceRow = dash.studentRow(/aderencia alice/i);
      await expect(aliceRow).toBeVisible();

      // Click the student row to expand.
      await aliceRow.click();
      // The expansion shows stats — Streak/Sequência and Total/Total.
      await expect(page.getByText(/streak:|sequência:/i)).toBeVisible({
        timeout: 10_000,
      });
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

  test('owner lands on the owner dashboard at /', async ({ browser }) => {
    const setup = await setupAcademy();
    academy = setup.academy;
    const owner = setup.instructor;
    await makeOwner(academy.id, owner.id);

    const context = await impersonateAs(browser, owner.email);
    try {
      const page = await context.newPage();
      await page.goto('/');

      // Owner shell renders the owner dashboard inline — the heading is
      // enough to prove it (the chart hides when there are no check-ins).
      await expect(
        page.getByRole('heading', { name: /academy dashboard|painel da academia/i }),
      ).toBeVisible({ timeout: 10_000 });
      // And the instructor StatCard grid from the old dashboard is NOT
      // rendered — guards against regressing to the link-card flow.
      await expect(page.getByRole('heading', { name: /^painel$|^dashboard$/i })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
