import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema/index.js';
import {
  createTestApp, cleanDb, createTestAcademy, createTestUser, createTestInstructor,
  createTestClass, authHeaders, testDb,
} from './helpers.js';

describe('requireOwner middleware (via /api/owner/students stub)', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('returns 403 for students', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { role: 'student' });
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(student) });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for instructors who are not the academy owner', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(instructor) });
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 for the academy owner', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ students: [] });
  });

  it("resolves the academy from the user's academyId, not from request input", async () => {
    const academyA = await createTestAcademy();
    const academyB = await createTestAcademy();
    const ownerOfB = await createTestUser(academyB.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: ownerOfB.id }).where(eq(schema.academy.id, academyB.id));
    // ownerOfB's academyId is academyB; requireOwner resolves from user.academyId, so this will check against academyB
    // and find that ownerOfB IS the owner of academyB → 200 expected.
    // (This test mainly guards against a buggy implementation that resolves academyId from somewhere else.)
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(ownerOfB) });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/owner/classes/aderencia', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('returns per-class aggregates with a 4-occurrence rolling trend', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id, { name: 'No-Gi', type: 'no-gi' });
    const s1 = await createTestUser(academy.id, { role: 'student' });
    const s2 = await createTestUser(academy.id, { role: 'student' });

    // 4 prior Mondays with 2 checkins each (baseline avg = 2)
    const baselineWeeks = ['2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13'];
    for (const d of baselineWeeks) {
      await testDb.insert(schema.checkin).values([
        { classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date(`${d}T18:00:00Z`) },
        { classId: cls.id, studentId: s2.id, source: 'button', checkedInAt: new Date(`${d}T18:00:00Z`) },
      ]);
    }
    // Current week: 2026-04-20 (Mon), 1 check-in → avg 1 → trend 0.5
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-20T18:00:00Z'),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/owner/classes/aderencia?period=week&from=2026-04-20',
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBe('week');
    expect(body.from).toBe('2026-04-20');
    expect(body.to).toBe('2026-04-27');
    expect(body.classes).toHaveLength(1);
    const c = body.classes[0];
    expect(c.classId).toBe(cls.id);
    expect(c.totalCheckins).toBe(1);
    expect(c.uniqueStudents).toBe(1);
    expect(c.occurrences).toBe(1);
    expect(c.avgPerOccurrence).toBeCloseTo(1);
    expect(c.trend).toBeCloseTo(0.5, 2);
  });

  it('returns trend:null for classes with <3 prior occurrences', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const s1 = await createTestUser(academy.id, { role: 'student' });
    // Only 1 checkin in current week, 0 prior
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-20T18:00:00Z'),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/owner/classes/aderencia?period=week&from=2026-04-20',
      headers: authHeaders(owner),
    });
    expect(res.json().classes[0].trend).toBeNull();
  });

  it('sorts classes by totalCheckins desc', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const clsA = await createTestClass(academy.id, { name: 'A' });
    const clsB = await createTestClass(academy.id, { name: 'B' });
    const s1 = await createTestUser(academy.id, { role: 'student' });
    const s2 = await createTestUser(academy.id, { role: 'student' });
    // B gets 2 checkins, A gets 1
    await testDb.insert(schema.checkin).values([
      { classId: clsA.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-20T18:00:00Z') },
      { classId: clsB.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-20T19:00:00Z') },
      { classId: clsB.id, studentId: s2.id, source: 'button', checkedInAt: new Date('2026-04-20T19:00:00Z') },
    ]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/owner/classes/aderencia?period=week&from=2026-04-20',
      headers: authHeaders(owner),
    });
    const names = res.json().classes.map((c: any) => c.name);
    expect(names).toEqual(['B', 'A']);
  });
});

describe('GET /api/owner/classes/:classId/occurrences', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('returns per-day check-in counts within the range, in academy TZ', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const s1 = await createTestUser(academy.id, { role: 'student' });
    const s2 = await createTestUser(academy.id, { role: 'student' });

    // 2026-04-20 Mon Lisbon: 2 checkins (UTC 18:00 + 19:00)
    await testDb.insert(schema.checkin).values([
      { classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-20T18:00:00Z') },
      { classId: cls.id, studentId: s2.id, source: 'button', checkedInAt: new Date('2026-04-20T19:00:00Z') },
    ]);
    // 2026-04-22T23:30Z → Lisbon 2026-04-23: 1 checkin
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-22T23:30:00Z'),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${cls.id}/occurrences?from=2026-04-20&to=2026-04-27`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classId).toBe(cls.id);
    expect(body.occurrences).toEqual([
      { date: '2026-04-20', checkins: 2, uniqueStudents: 2 },
      { date: '2026-04-23', checkins: 1, uniqueStudents: 1 },
    ]);
  });

  it('returns 404 for a class in another academy', async () => {
    const a1 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const a2 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(a1.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, a1.id));
    const otherClass = await createTestClass(a2.id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${otherClass.id}/occurrences?from=2026-04-20&to=2026-04-27`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 if from or to is missing', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${cls.id}/occurrences?from=2026-04-20`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/owner/students (real handler)', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('buckets students by days since last check-in', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner', name: 'Owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const sActive = await createTestUser(academy.id, { role: 'student', name: 'Active' });
    const sSlowing = await createTestUser(academy.id, { role: 'student', name: 'Slowing' });
    const sDrifting = await createTestUser(academy.id, { role: 'student', name: 'Drifting' });
    const sInactive = await createTestUser(academy.id, { role: 'student', name: 'Inactive' });
    const sNever = await createTestUser(academy.id, { role: 'student', name: 'NeverCheckedIn' });

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    await testDb.insert(schema.checkin).values([
      { classId: cls.id, studentId: sActive.id,   source: 'button', checkedInAt: daysAgo(2) },
      { classId: cls.id, studentId: sSlowing.id,  source: 'button', checkedInAt: daysAgo(10) },
      { classId: cls.id, studentId: sDrifting.id, source: 'button', checkedInAt: daysAgo(20) },
      { classId: cls.id, studentId: sInactive.id, source: 'button', checkedInAt: daysAgo(40) },
    ]);

    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const names = body.students.map((s: any) => s.name);
    expect(names).not.toContain('Owner');
    expect(new Set(names)).toEqual(new Set(['Active', 'Slowing', 'Drifting', 'Inactive', 'NeverCheckedIn']));

    const byName = Object.fromEntries(body.students.map((s: any) => [s.name, s]));
    expect(byName.Active.status).toBe('active');
    expect(byName.Slowing.status).toBe('slowing');
    expect(byName.Drifting.status).toBe('drifting');
    expect(byName.Inactive.status).toBe('inactive');
    expect(byName.NeverCheckedIn.status).toBe('inactive');
    expect(byName.NeverCheckedIn.daysSinceCheckin).toBeNull();
    expect(byName.NeverCheckedIn.lastCheckinAt).toBeNull();
    expect(byName.Active.daysSinceCheckin).toBeGreaterThanOrEqual(1);
    expect(byName.Active.daysSinceCheckin).toBeLessThan(7);
  });

  it('filters by status query param', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const s1 = await createTestUser(academy.id, { role: 'student' });
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: s1.id, source: 'button',
      checkedInAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago → drifting
    });
    const resActive = await app.inject({
      method: 'GET', url: '/api/owner/students?status=active', headers: authHeaders(owner),
    });
    expect(resActive.json().students).toHaveLength(0);
    const resDrifting = await app.inject({
      method: 'GET', url: '/api/owner/students?status=drifting', headers: authHeaders(owner),
    });
    expect(resDrifting.json().students).toHaveLength(1);
  });

  it('excludes students from other academies', async () => {
    const a1 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const a2 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(a1.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, a1.id));
    await createTestUser(a1.id, { role: 'student', name: 'MyStudent' });
    await createTestUser(a2.id, { role: 'student', name: 'OtherAcademyStudent' });
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    const names = res.json().students.map((s: any) => s.name);
    expect(names).toContain('MyStudent');
    expect(names).not.toContain('OtherAcademyStudent');
  });
});

describe('GET /api/owner/classes/:classId/occurrences/:date/roster', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('returns the students who checked in on that Lisbon-TZ calendar day', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const s1 = await createTestUser(academy.id, { role: 'student', name: 'João', belt: 'blue' });
    const s2 = await createTestUser(academy.id, { role: 'student', name: 'Maria', belt: 'white' });

    await testDb.insert(schema.checkin).values([
      { classId: cls.id, studentId: s1.id, source: 'button', checkedInAt: new Date('2026-04-22T23:30:00Z') }, // Lisbon 2026-04-23 00:30
      { classId: cls.id, studentId: s2.id, source: 'qr',     checkedInAt: new Date('2026-04-23T00:15:00Z') }, // Lisbon 2026-04-23 01:15
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${cls.id}/occurrences/2026-04-23/roster`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.classId).toBe(cls.id);
    expect(body.date).toBe('2026-04-23');
    expect(body.students).toHaveLength(2);
    // Order asc by checkedInAt — s1 (22:30Z) first, s2 (23:15Z next day UTC) second
    expect(body.students[0].name).toBe('João');
    expect(body.students[0].source).toBe('button');
    expect(body.students[0].belt).toBe('blue');
    expect(body.students[1].name).toBe('Maria');
    expect(body.students[1].source).toBe('qr');
    expect(body.students[1].belt).toBe('white');
  });

  it('returns empty students array for a day with no checkins', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const cls = await createTestClass(academy.id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${cls.id}/occurrences/2026-04-23/roster`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().students).toEqual([]);
  });

  it('returns 404 for a class in another academy', async () => {
    const a1 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const a2 = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(a1.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, a1.id));
    const foreignCls = await createTestClass(a2.id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/classes/${foreignCls.id}/occurrences/2026-04-23/roster`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(404);
  });
});
