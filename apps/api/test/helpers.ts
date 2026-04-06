import { db } from '../src/db/client.js';
import { buildApp } from '../src/app.js';
import { academy, user } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

export async function createTestApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function createTestAcademy(name = 'Test Academy') {
  const [result] = await db.insert(academy).values({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
  }).returning();
  return result;
}

export async function createTestUser(academyId: string, overrides: Partial<typeof user.$inferInsert> = {}) {
  const [result] = await db.insert(user).values({
    academyId,
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    name: 'Test User',
    role: 'student',
    belt: 'white',
    ...overrides,
  }).returning();
  return result;
}
