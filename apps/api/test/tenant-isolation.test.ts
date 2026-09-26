import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestOwner,
  createTestClass,
  authHeaders,
  testDb,
} from './helpers';
import * as schema from '../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { isoDateInTz, DEFAULT_ACADEMY_TIMEZONE } from '../src/utils/timezone.js';

// Academy-scoped reads must require a session and only ever return the
// caller's own academy — never the one named in the query string.

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

async function seedTwoAcademies() {
  const a = await createTestAcademy({ name: 'A' });
  const b = await createTestAcademy({ name: 'B' });
  const ownerA = await createTestOwner(a.id);
  const studentA = await createTestUser(a.id, { name: 'Student A' });
  const ownerB = await createTestOwner(b.id);
  const studentB = await createTestUser(b.id, { name: 'Student B' });

  const classA = await createTestClass(a.id, { instructorId: ownerA.id, name: 'Class A' });
  const classB = await createTestClass(b.id, { instructorId: ownerB.id, name: 'Class B' });
  await testDb.insert(schema.checkin).values({ studentId: studentB.id, classId: classB.id, source: 'button' });

  const [modalityA, modalityB] = await testDb.insert(schema.modality).values([
    { academyId: a.id, name: 'Modality A' },
    { academyId: b.id, name: 'Modality B' },
  ]).returning();
  const [badgeA, badgeB] = await testDb.insert(schema.badgeDefinition).values([
    { academyId: a.id, name: 'Badge A', description: 'a', icon: 'x', criteriaType: 'manual', criteriaValue: 1 },
    { academyId: b.id, name: 'Badge B', description: 'b', icon: 'x', criteriaType: 'manual', criteriaValue: 1 },
  ]).returning();
  const [productA, productB] = await testDb.insert(schema.product).values([
    { academyId: a.id, name: 'Product A', price: '10.00' },
    { academyId: b.id, name: 'Product B', price: '10.00' },
  ]).returning();
  const [orderB] = await testDb.insert(schema.order).values({ productId: productB.id, studentId: studentB.id, quantity: 1 }).returning();
  const pendingB = await createTestUser(b.id, { status: 'pending' });
  await testDb.insert(schema.studentMembership).values({ studentId: studentB.id, monthlyFee: '60.00', startDate: '2026-01-01', dueDay: 5 });

  const seasonValues = { startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10 } };
  const [seasonA] = await testDb.insert(schema.season).values({ academyId: a.id, name: 'Season A', ...seasonValues }).returning();
  const [seasonB] = await testDb.insert(schema.season).values({ academyId: b.id, name: 'Season B', ...seasonValues }).returning();
  const [resultB] = await testDb.insert(schema.competitionResult).values({
    seasonId: seasonB.id,
    studentId: studentB.id,
    competitionName: 'Comp B',
    competitionDate: '2026-02-01',
    position: 1,
    pointsAwarded: 10,
    status: 'approved',
    submittedBy: studentB.id,
  }).returning();

  const [tournamentA] = await testDb.insert(schema.tournament).values({ academyId: a.id, name: 'Tournament A', date: '2026-06-01' }).returning();
  const [tournamentB] = await testDb.insert(schema.tournament).values({ academyId: b.id, name: 'Tournament B', date: '2026-06-01' }).returning();
  await testDb.insert(schema.tournamentSignup).values({ tournamentId: tournamentB.id, studentId: studentB.id, weightClass: 'Leve' });

  return {
    a, b, ownerA, studentA, ownerB, studentB, pendingB, classA, classB, seasonA, seasonB, resultB,
    tournamentA, tournamentB, modalityA, modalityB, badgeA, badgeB, productA, productB, orderB,
  };
}

describe('unauthenticated reads are rejected', () => {
  it('returns 401 on every academy-scoped GET', async () => {
    const s = await seedTwoAcademies();
    const urls = [
      `/api/classes?academyId=${s.b.id}`,
      `/api/checkins/class/${s.classB.id}`,
      `/api/competition-results?seasonId=${s.seasonB.id}`,
      `/api/modalities?academyId=${s.b.id}`,
      `/api/gamification/badges?academyId=${s.b.id}`,
      `/api/products?academyId=${s.b.id}`,
      `/api/seasons?academyId=${s.b.id}`,
      `/api/seasons/${s.seasonB.id}`,
      `/api/seasons/${s.seasonB.id}/leaderboard`,
      `/api/tournaments?academyId=${s.b.id}`,
      `/api/tournaments/${s.tournamentB.id}/roster`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
  });
});

describe('list endpoints ignore ?academyId and use the session academy', () => {
  const cases: Array<[string, string, 'student' | 'owner']> = [
    ['/api/classes', 'Class A', 'student'],
    ['/api/gamification/badges', 'Badge A', 'student'],
    ['/api/products', 'Product A', 'student'],
    ['/api/seasons', 'Season A', 'student'],
    ['/api/tournaments', 'Tournament A', 'student'],
    ['/api/modalities', 'Modality A', 'student'],
  ];
  for (const [path, expectedName, as] of cases) {
    it(`${path} returns only academy A to a member of A asking for B`, async () => {
      const s = await seedTwoAcademies();
      const caller = as === 'owner' ? s.ownerA : s.studentA;
      const res = await app.inject({
        method: 'GET',
        url: `${path}?academyId=${s.b.id}`,
        headers: authHeaders(caller),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().map((r: any) => r.name)).toEqual([expectedName]);
    });
  }

  it('GET /api/orders returns only the owner academy orders', async () => {
    const s = await seedTwoAcademies();
    const [productB] = await testDb.select().from(schema.product).where(eq(schema.product.name, 'Product B'));
    const studentB = await createTestUser(s.b.id);
    await testDb.insert(schema.order).values({ productId: productB.id, studentId: studentB.id, quantity: 1 });
    const res = await app.inject({
      method: 'GET',
      url: `/api/orders?academyId=${s.b.id}`,
      headers: authHeaders(s.ownerA),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe(':id endpoints return 404 for another academy records', () => {
  it('GET /api/seasons/:id', async () => {
    const s = await seedTwoAcademies();
    const own = await app.inject({ method: 'GET', url: `/api/seasons/${s.seasonA.id}`, headers: authHeaders(s.studentA) });
    expect(own.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/seasons/${s.seasonB.id}`, headers: authHeaders(s.studentA) });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/seasons/:id/leaderboard', async () => {
    const s = await seedTwoAcademies();
    const own = await app.inject({ method: 'GET', url: `/api/seasons/${s.seasonA.id}/leaderboard`, headers: authHeaders(s.studentA) });
    expect(own.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/seasons/${s.seasonB.id}/leaderboard`, headers: authHeaders(s.studentA) });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/tournaments/:id/roster', async () => {
    const s = await seedTwoAcademies();
    const own = await app.inject({ method: 'GET', url: `/api/tournaments/${s.tournamentA.id}/roster`, headers: authHeaders(s.studentA) });
    expect(own.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/tournaments/${s.tournamentB.id}/roster`, headers: authHeaders(s.studentA) });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/competition-results?seasonId= of another academy', async () => {
    const s = await seedTwoAcademies();
    const own = await app.inject({ method: 'GET', url: `/api/competition-results?seasonId=${s.seasonA.id}`, headers: authHeaders(s.ownerA) });
    expect(own.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/competition-results?seasonId=${s.seasonB.id}`, headers: authHeaders(s.ownerA) });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/checkins/class/:classId of another academy', async () => {
    const s = await seedTwoAcademies();
    const own = await app.inject({ method: 'GET', url: `/api/checkins/class/${s.classA.id}`, headers: authHeaders(s.ownerA) });
    expect(own.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/checkins/class/${s.classB.id}`, headers: authHeaders(s.ownerA) });
    expect(res.statusCode).toBe(404);
  });
});

describe('owner-only reads', () => {
  it('students get 403 on class check-ins and competition results', async () => {
    const s = await seedTwoAcademies();
    const urls = [
      `/api/checkins/class/${s.classA.id}`,
      `/api/competition-results?seasonId=${s.seasonA.id}`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: 'GET', url, headers: authHeaders(s.studentA) });
      expect(res.statusCode, url).toBe(403);
    }
  });
});

describe('student-scoped reads and cross-academy writes', () => {
  it('GET /api/orders/student/:studentId is self or same-academy owner only', async () => {
    const s = await seedTwoAcademies();
    const url = `/api/orders/student/${s.studentB.id}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url, headers: authHeaders(s.studentA) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url, headers: authHeaders(s.ownerA) })).statusCode).toBe(403);
    const own = await app.inject({ method: 'GET', url, headers: authHeaders(s.studentB) });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toHaveLength(1);
  });

  it('approve/reject a competition result of another academy -> 404, untouched', async () => {
    const s = await seedTwoAcademies();
    for (const action of ['approve', 'reject']) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/competition-results/${s.resultB.id}/${action}`,
        headers: authHeaders(s.ownerA),
      });
      expect(res.statusCode, action).toBe(404);
    }
    const [row] = await testDb.select().from(schema.competitionResult).where(eq(schema.competitionResult.id, s.resultB.id));
    expect(row.reviewedBy).toBeNull();
  });

  it('award badge: badge or student of another academy -> 404', async () => {
    const s = await seedTwoAcademies();
    const urls = [
      `/api/gamification/badges/${s.badgeB.id}/award/${s.studentA.id}`,
      `/api/gamification/badges/${s.badgeA.id}/award/${s.studentB.id}`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: 'POST', url, headers: authHeaders(s.ownerA) });
      expect(res.statusCode, url).toBe(404);
    }
    const ok = await app.inject({
      method: 'POST',
      url: `/api/gamification/badges/${s.badgeA.id}/award/${s.studentA.id}`,
      headers: authHeaders(s.ownerA),
    });
    expect(ok.statusCode).toBe(201);
  });

  it('POST /api/tournaments/:id/signup checks tournament academy and studentId', async () => {
    const s = await seedTwoAcademies();
    const signup = (tournamentId: string, caller: any, studentId: string) =>
      app.inject({
        method: 'POST',
        url: `/api/tournaments/${tournamentId}/signup`,
        headers: authHeaders(caller),
        payload: { studentId, weightClass: 'Leve' },
      });
    expect((await signup(s.tournamentB.id, s.studentA, s.studentA.id)).statusCode).toBe(404);
    expect((await signup(s.tournamentA.id, s.studentA, s.studentB.id)).statusCode).toBe(403);
    expect((await signup(s.tournamentA.id, s.ownerA, s.studentB.id)).statusCode).toBe(404);
    expect((await signup(s.tournamentA.id, s.ownerA, s.studentA.id)).statusCode).toBe(201);
  });

  it('POST /api/competition-results checks season academy and studentId', async () => {
    const s = await seedTwoAcademies();
    const submit = (seasonId: string, caller: any, studentId: string) =>
      app.inject({
        method: 'POST',
        url: '/api/competition-results',
        headers: authHeaders(caller),
        payload: { seasonId, studentId, competitionName: 'Open', competitionDate: '2026-03-01', position: 1 },
      });
    expect((await submit(s.seasonB.id, s.studentA, s.studentA.id)).statusCode).toBe(404);
    expect((await submit(s.seasonA.id, s.studentA, s.studentB.id)).statusCode).toBe(403);
    expect((await submit(s.seasonA.id, s.ownerA, s.studentB.id)).statusCode).toBe(404);
    expect((await submit(s.seasonA.id, s.ownerA, s.studentA.id)).statusCode).toBe(201);
  });
});

describe('sweep: other writes by id are academy-scoped', () => {
  it('orders: status of another academy order, foreign product, other student', async () => {
    const s = await seedTwoAcademies();
    const put = await app.inject({
      method: 'PUT',
      url: `/api/orders/${s.orderB.id}/status`,
      headers: authHeaders(s.ownerA),
      payload: { status: 'delivered' },
    });
    expect(put.statusCode).toBe(404);
    const order = (caller: any, productId: string, studentId: string) =>
      app.inject({ method: 'POST', url: '/api/orders', headers: authHeaders(caller), payload: { productId, studentId, quantity: 1 } });
    expect((await order(s.studentA, s.productB.id, s.studentA.id)).statusCode).toBe(404);
    expect((await order(s.studentA, s.productA.id, s.studentB.id)).statusCode).toBe(403);
    expect((await order(s.studentA, s.productA.id, s.studentA.id)).statusCode).toBe(201);
  });

  it('academies: pending/approve/reject of another academy -> 404', async () => {
    const s = await seedTwoAcademies();
    const reqs = [
      { method: 'GET' as const, url: `/api/academies/${s.b.id}/pending` },
      { method: 'POST' as const, url: `/api/academies/${s.b.id}/approve/${s.pendingB.id}` },
      { method: 'POST' as const, url: `/api/academies/${s.b.id}/reject/${s.pendingB.id}` },
    ];
    for (const r of reqs) {
      const res = await app.inject({ ...r, headers: authHeaders(s.ownerA) });
      expect(res.statusCode, r.url).toBe(404);
    }
    const [row] = await testDb.select().from(schema.user).where(eq(schema.user.id, s.pendingB.id));
    expect(row.status).toBe('pending');
  });

  it('payments/students/modalities: student or modality of another academy -> 404', async () => {
    const s = await seedTwoAcademies();
    const reqs = [
      { method: 'POST' as const, url: '/api/payments', payload: { studentId: s.studentB.id, amount: '10.00', paymentDate: '2026-03-01', referenceMonth: '2026-03' } },
      { method: 'POST' as const, url: `/api/payments/overdue/${s.studentB.id}/notify` },
      { method: 'PUT' as const, url: `/api/students/${s.studentB.id}/membership`, payload: { monthlyFee: '45.00' } },
      { method: 'PUT' as const, url: `/api/students/${s.studentB.id}/training`, payload: { modalityIds: [], trainingNote: null } },
      { method: 'PUT' as const, url: `/api/students/${s.studentA.id}/training`, payload: { modalityIds: [s.modalityB.id], trainingNote: null } },
      { method: 'PUT' as const, url: `/api/modalities/${s.modalityB.id}`, payload: { name: 'Renamed' } },
      { method: 'DELETE' as const, url: `/api/modalities/${s.modalityB.id}` },
      { method: 'PUT' as const, url: `/api/students/${s.studentB.id}/notifications`, payload: { muted: true } },
    ];
    for (const r of reqs) {
      const res = await app.inject({ ...r, headers: authHeaders(s.ownerA) });
      expect(res.statusCode, r.url).toBe(404);
    }
  });

  it('POST /api/checkins rejects a class of another academy', async () => {
    const s = await seedTwoAcademies();
    await testDb.update(schema.academy).set({ latitude: '38.7', longitude: '-9.1' }).where(eq(schema.academy.id, s.b.id));
    const [academyB] = await testDb.select().from(schema.academy).where(eq(schema.academy.id, s.b.id));
    const today = isoDateInTz(new Date(), academyB.timezone ?? DEFAULT_ACADEMY_TIMEZONE);
    const cls = await createTestClass(s.b.id, { recurrence: 'once', dayOfWeek: null, date: today, startTime: '00:00', endTime: '23:59' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(s.studentA),
      payload: { classId: cls.id, source: 'button', latitude: 38.7, longitude: -9.1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CLASS_NOT_ACTIVE');
  });
});

describe('PUT bodies cannot move records to another academy', () => {
  it('ignores academyId in the body of class/modality/season/product updates', async () => {
    const s = await seedTwoAcademies();
    const [productA] = await testDb.select().from(schema.product).where(eq(schema.product.id, s.productA.id));
    const cases = [
      { url: `/api/classes/${s.classA.id}`, table: schema.bjjClass, id: s.classA.id },
      { url: `/api/modalities/${s.modalityA.id}`, table: schema.modality, id: s.modalityA.id },
      { url: `/api/seasons/${s.seasonA.id}`, table: schema.season, id: s.seasonA.id },
      { url: `/api/products/${productA.id}`, table: schema.product, id: productA.id },
    ];
    for (const c of cases) {
      const res = await app.inject({
        method: 'PUT',
        url: c.url,
        headers: authHeaders(s.ownerA),
        payload: { name: 'Renamed', academyId: s.b.id },
      });
      expect(res.statusCode, c.url).toBe(200);
      const [row] = await testDb.select().from(c.table).where(eq(c.table.id, c.id));
      expect(row.name, c.url).toBe('Renamed');
      expect(row.academyId, c.url).toBe(s.a.id);
    }
  });
});
