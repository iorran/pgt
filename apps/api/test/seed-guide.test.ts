import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, testDb } from './helpers';
import { seedGuide } from '../src/db/seed-guide';
import {
  academy,
  user,
  bjjClass,
  membershipPlan,
  studentMembership,
  payment,
  tournament,
  product,
} from '../src/db/schema/index';
import { eq, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

async function countDemo() {
  const [acad] = await testDb
    .select()
    .from(academy)
    .where(eq(academy.slug, 'demo-pgt'));
  if (!acad) {
    return {
      academy: null,
      users: 0,
      classes: 0,
      plans: 0,
      memberships: 0,
      payments: 0,
      tournaments: 0,
      products: 0,
    };
  }
  const users = await testDb
    .select()
    .from(user)
    .where(eq(user.academyId, acad.id));
  const classes = await testDb
    .select()
    .from(bjjClass)
    .where(eq(bjjClass.academyId, acad.id));
  const plans = await testDb
    .select()
    .from(membershipPlan)
    .where(eq(membershipPlan.academyId, acad.id));
  const memberships = await testDb
    .select()
    .from(studentMembership)
    .innerJoin(user, eq(studentMembership.studentId, user.id))
    .where(eq(user.academyId, acad.id));
  const payments = await testDb
    .select()
    .from(payment)
    .where(eq(payment.academyId, acad.id));
  const tournaments = await testDb
    .select()
    .from(tournament)
    .where(eq(tournament.academyId, acad.id));
  const products = await testDb
    .select()
    .from(product)
    .where(eq(product.academyId, acad.id));
  return {
    academy: acad,
    users: users.length,
    classes: classes.length,
    plans: plans.length,
    memberships: memberships.length,
    payments: payments.length,
    tournaments: tournaments.length,
    products: products.length,
  };
}

describe('seedGuide', () => {
  it('creates the canonical demo academy with expected entity counts', async () => {
    await seedGuide({ db: testDb });

    const counts = await countDemo();
    expect(counts.academy).not.toBeNull();
    expect(counts.academy?.name).toBe('Academia Demo PGT');
    expect(counts.academy?.city).toBe('Lisboa');
    expect(counts.users).toBe(5); // 1 instructor + 4 students
    expect(counts.classes).toBeGreaterThanOrEqual(2);
    expect(counts.classes).toBeLessThanOrEqual(3);
    expect(counts.plans).toBe(1);
    expect(counts.memberships).toBe(3); // 4 students but 1 is pending
    expect(counts.payments).toBeGreaterThanOrEqual(3);
    expect(counts.tournaments).toBe(1);
    expect(counts.products).toBe(1);
  });

  it('is idempotent — running twice leaves the same state', async () => {
    await seedGuide({ db: testDb });
    const first = await countDemo();

    await seedGuide({ db: testDb });
    const second = await countDemo();

    expect(second.academy?.id).toBe(first.academy?.id);
    expect(second).toEqual(first);
  });

  it('does not touch other academies', async () => {
    const [other] = await testDb
      .insert(academy)
      .values({
        name: 'Other Academy',
        slug: 'other',
        joinCode: 'OTHER-1',
        city: 'Other City',
      })
      .returning();

    await seedGuide({ db: testDb });

    const [stillThere] = await testDb
      .select()
      .from(academy)
      .where(eq(academy.slug, 'other'));
    expect(stillThere).toBeDefined();
    expect(stillThere.id).toBe(other.id);
  });

  it('creates the demo academy owner with the canonical email and role', async () => {
    await seedGuide({ db: testDb });

    const [instructor] = await testDb
      .select()
      .from(user)
      .where(
        and(
          eq(user.email, 'instrutor@demo.pgt'),
          eq(user.role, 'owner'),
        ),
      );
    expect(instructor).toBeDefined();
    expect(instructor.status).toBe('active');
  });
});
