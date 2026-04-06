import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema/index.js';
import { buildApp } from '../src/app.js';
import { sql } from 'drizzle-orm';

// Create a test-specific DB connection
const testConnection = postgres(
  process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/pgt_test',
);
export const testDb = drizzle(testConnection, { schema });

// Build app with test DB
export async function createTestApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

// Clean all tables between tests (truncate in FK-safe order)
export async function cleanDb() {
  await testDb.execute(sql`
    TRUNCATE TABLE
      xp_entry, student_badge, badge_definition, streak,
      tournament_signup, tournament,
      competition_result, season,
      "order", product,
      payment, student_membership, membership_plan,
      checkin, class,
      session, account, verification,
      "user", academy
    CASCADE
  `);
}

// Factory: create academy
export async function createTestAcademy(
  overrides: Partial<typeof schema.academy.$inferInsert> = {},
) {
  const ts = Date.now();
  const [result] = await testDb
    .insert(schema.academy)
    .values({
      name: 'Test Academy',
      slug: `test-academy-${ts}`,
      joinCode: `TEST-${ts}`,
      city: 'Test City',
      ...overrides,
    })
    .returning();
  return result;
}

// Factory: create user
export async function createTestUser(
  academyId: string | null,
  overrides: Partial<typeof schema.user.$inferInsert> = {},
) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const [result] = await testDb
    .insert(schema.user)
    .values({
      academyId,
      email: `test-${ts}-${rand}@test.com`,
      name: 'Test User',
      role: 'student',
      belt: 'white',
      status: 'active',
      emailVerified: false,
      ...overrides,
    })
    .returning();
  return result;
}

// Factory: create instructor
export async function createTestInstructor(
  academyId: string,
  overrides: Partial<typeof schema.user.$inferInsert> = {},
) {
  return createTestUser(academyId, {
    role: 'instructor',
    belt: 'black',
    name: 'Test Instructor',
    ...overrides,
  });
}

// Helper: inject auth into a request (bypasses BetterAuth)
export function authHeaders(user: any) {
  return {
    'x-test-user-id': user.id,
    'x-test-user-role': user.role,
    'x-test-user-academy-id': user.academyId || '',
    'x-test-user-status': user.status || 'active',
  };
}
