import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../apps/api/src/db/schema/index.js';

const {
  academy,
  user,
  bjjClass,
  membershipPlan,
  studentMembership,
  payment,
  checkinToken,
  checkin,
  product,
  order,
  tournament,
  tournamentSignup,
  competitionResult,
  session,
  account,
  xpEntry,
  studentBadge,
  streak,
} = schema;

// Share the dev DB connection (localhost:5432/pgt)
const connection = postgres(
  process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/pgt',
);

export const e2eDb = drizzle(connection, { schema });

// Re-export schema tables for tests that need direct-DB inserts/updates
// for ad-hoc state not covered by a helper function.
export { schema };

type InsertAcademy = typeof academy.$inferInsert;
type InsertUser = typeof user.$inferInsert;
type InsertPlan = typeof membershipPlan.$inferInsert;
type InsertMembership = typeof studentMembership.$inferInsert;
type InsertPayment = typeof payment.$inferInsert;
type InsertClass = typeof bjjClass.$inferInsert;

export type FixtureAcademy = typeof academy.$inferSelect;
export type FixtureUser = typeof user.$inferSelect;
export type FixturePlan = typeof membershipPlan.$inferSelect;
export type FixtureClass = typeof bjjClass.$inferSelect;

function randomSlug(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create an ephemeral academy with an instructor owner.
 */
export async function setupAcademy(
  overrides?: Partial<InsertAcademy>,
): Promise<{ academy: FixtureAcademy; instructor: FixtureUser }> {
  const slug = randomSlug('acad');
  const [acad] = await e2eDb
    .insert(academy)
    .values({
      name: overrides?.name ?? `E2E Academy ${slug}`,
      slug,
      joinCode: `E2E-${slug.toUpperCase().slice(4, 14)}`,
      city: overrides?.city ?? 'Lisboa',
      ...overrides,
    })
    .returning();

  const [instructor] = await e2eDb
    .insert(user)
    .values({
      academyId: acad.id,
      email: `instrutor+${slug}@e2e.pgt`,
      name: 'E2E Instructor',
      role: 'instructor',
      belt: 'black',
      dateOfBirth: '1985-01-01',
      status: 'active',
    })
    .returning();

  await e2eDb
    .update(academy)
    .set({ ownerId: instructor.id })
    .where(eq(academy.id, acad.id));

  return { academy: acad, instructor };
}

export async function createStudent(
  academyId: string,
  overrides?: Partial<InsertUser>,
): Promise<FixtureUser> {
  const rand = Math.random().toString(36).slice(2, 8);
  const [student] = await e2eDb
    .insert(user)
    .values({
      academyId,
      email: `student+${rand}@e2e.pgt`,
      name: overrides?.name ?? `E2E Student ${rand}`,
      role: 'student',
      belt: 'white',
      dateOfBirth: '2000-01-01',
      status: 'active',
      ...overrides,
    })
    .returning();
  return student;
}

export async function createPlan(
  academyId: string,
  overrides?: Partial<InsertPlan>,
): Promise<FixturePlan> {
  const [plan] = await e2eDb
    .insert(membershipPlan)
    .values({
      academyId,
      name: overrides?.name ?? 'E2E Mensal Ilimitado',
      price: overrides?.price ?? '180.00',
      frequency: 'monthly',
      classesPerWeek: overrides?.classesPerWeek ?? null,
      ...overrides,
    })
    .returning();
  return plan;
}

export async function assignMembership(
  studentId: string,
  planId: string,
  overrides?: Partial<InsertMembership>,
): Promise<void> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  await e2eDb.insert(studentMembership).values({
    studentId,
    planId,
    startDate: overrides?.startDate ?? monthStart,
    dueDay: overrides?.dueDay ?? 1,
    active: true,
    ...overrides,
  });
}

export async function createPayment(
  studentId: string,
  academyId: string,
  instructorId: string,
  overrides?: Partial<InsertPayment>,
): Promise<void> {
  const now = new Date();
  const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const paymentDate = `${refMonth}-15`;
  await e2eDb.insert(payment).values({
    studentId,
    academyId,
    amount: overrides?.amount ?? '180.00',
    paymentDate: overrides?.paymentDate ?? paymentDate,
    referenceMonth: overrides?.referenceMonth ?? refMonth,
    recordedBy: instructorId,
    ...overrides,
  });
}

export async function createClass(
  academyId: string,
  instructorId: string,
  overrides?: Partial<InsertClass>,
): Promise<FixtureClass> {
  const [cls] = await e2eDb
    .insert(bjjClass)
    .values({
      academyId,
      instructorId,
      name: overrides?.name ?? 'E2E Gi Manhã',
      type: overrides?.type ?? 'gi',
      recurrence: overrides?.recurrence ?? 'weekly',
      dayOfWeek: overrides?.dayOfWeek ?? 1,
      startTime: overrides?.startTime ?? '07:00',
      endTime: overrides?.endTime ?? '08:30',
      active: true,
      ...overrides,
    })
    .returning();
  return cls;
}

/**
 * Delete an academy and every row that depends on it. Used in afterEach.
 *
 * NOTE: The `order` table has no `academyId` column — orders are linked to
 * products, so we collect product IDs first and delete orders via those.
 */
export async function cleanAcademy(academyId: string): Promise<void> {
  const users = await e2eDb
    .select({ id: user.id })
    .from(user)
    .where(eq(user.academyId, academyId));
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    await e2eDb.delete(session).where(inArray(session.userId, userIds));
    await e2eDb.delete(account).where(inArray(account.userId, userIds));
    // xpEntry uses studentId column
    await e2eDb.delete(xpEntry).where(inArray(xpEntry.studentId, userIds));
    // studentBadge uses studentId column
    await e2eDb
      .delete(studentBadge)
      .where(inArray(studentBadge.studentId, userIds));
    // streak uses studentId column
    await e2eDb.delete(streak).where(inArray(streak.studentId, userIds));
    // tournamentSignup uses studentId column (not userId)
    await e2eDb
      .delete(tournamentSignup)
      .where(inArray(tournamentSignup.studentId, userIds));
    // competitionResult uses studentId column
    await e2eDb
      .delete(competitionResult)
      .where(inArray(competitionResult.studentId, userIds));
    await e2eDb
      .delete(studentMembership)
      .where(inArray(studentMembership.studentId, userIds));
    await e2eDb.delete(checkin).where(inArray(checkin.studentId, userIds));
  }

  // order has no academyId — delete via product IDs
  const products = await e2eDb
    .select({ id: product.id })
    .from(product)
    .where(eq(product.academyId, academyId));
  const productIds = products.map((p) => p.id);
  if (productIds.length > 0) {
    await e2eDb.delete(order).where(inArray(order.productId, productIds));
  }
  await e2eDb.delete(product).where(eq(product.academyId, academyId));

  await e2eDb.delete(tournament).where(eq(tournament.academyId, academyId));
  await e2eDb.delete(payment).where(eq(payment.academyId, academyId));
  await e2eDb
    .delete(membershipPlan)
    .where(eq(membershipPlan.academyId, academyId));

  // Collect class ids for checkinToken cleanup
  const classes = await e2eDb
    .select({ id: bjjClass.id })
    .from(bjjClass)
    .where(eq(bjjClass.academyId, academyId));
  const classIds = classes.map((c) => c.id);
  if (classIds.length > 0) {
    await e2eDb
      .delete(checkinToken)
      .where(inArray(checkinToken.classId, classIds));
  }
  await e2eDb.delete(bjjClass).where(eq(bjjClass.academyId, academyId));

  // Clear owner before deleting users (FK from academy -> user)
  await e2eDb
    .update(academy)
    .set({ ownerId: null })
    .where(eq(academy.id, academyId));
  if (userIds.length > 0) {
    await e2eDb.delete(user).where(inArray(user.id, userIds));
  }
  await e2eDb.delete(academy).where(eq(academy.id, academyId));
}

export async function scenarioInstructorWithApprovedStudent(): Promise<{
  academy: FixtureAcademy;
  instructor: FixtureUser;
  student: FixtureUser;
  plan: FixturePlan;
}> {
  const { academy: acad, instructor } = await setupAcademy();
  const plan = await createPlan(acad.id);
  const student = await createStudent(acad.id, { belt: 'blue' });
  await assignMembership(student.id, plan.id);
  return { academy: acad, instructor, student, plan };
}

export async function scenarioInstructorWithPendingStudent(): Promise<{
  academy: FixtureAcademy;
  instructor: FixtureUser;
  pendingStudent: FixtureUser;
}> {
  const { academy: acad, instructor } = await setupAcademy();
  const pendingStudent = await createStudent(acad.id, {
    status: 'pending',
    name: 'E2E Pending Student',
  });
  return { academy: acad, instructor, pendingStudent };
}

export async function scenarioStudentWithOverdueBilling(): Promise<{
  academy: FixtureAcademy;
  instructor: FixtureUser;
  student: FixtureUser;
  plan: FixturePlan;
}> {
  const { academy: acad, instructor } = await setupAcademy();
  const plan = await createPlan(acad.id);
  const student = await createStudent(acad.id, { name: 'E2E Overdue Student' });

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
  await assignMembership(student.id, plan.id, {
    startDate,
    dueDay: 1,
  });
  return { academy: acad, instructor, student, plan };
}
