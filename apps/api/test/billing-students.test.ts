import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 26, 12)); // 2026-09-26
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => { await cleanDb(); });

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const [plan] = await testDb.insert(schema.membershipPlan).values({
    academyId: academy.id, name: 'Adults', price: '45.00', frequency: 'monthly',
  }).returning();
  const student = await createTestUser(academy.id, { name: 'Ana', phone: '912' });
  await testDb.insert(schema.studentMembership).values({
    studentId: student.id, planId: plan.id, startDate: '2026-08-01', dueDay: 10, agreedPrice: '35.00',
  });
  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }
  return { academy, owner, plan, student, api };
}

describe('academy scoping of list endpoints', () => {
  for (const path of ['/api/students', '/api/payments', '/api/payments/overdue']) {
    it(`${path}: 401 unauthenticated, 403 student, owner only sees own academy`, async () => {
      const a = await setup();
      const b = await setup();
      await testDb.insert(schema.payment).values({
        studentId: b.student.id, academyId: b.academy.id, amount: '1.00', paymentDate: '2026-09-01', referenceMonth: '2026-06', recordedBy: b.owner.id,
      });

      expect((await app.inject({ method: 'GET', url: `${path}?academyId=${b.academy.id}` })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: `${path}?academyId=${b.academy.id}`, headers: authHeaders(b.student) })).statusCode).toBe(403);

      const res = await a.api('GET', `${path}?academyId=${b.academy.id}`);
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(res.json())).not.toContain(b.student.id);
    });
  }
});

describe('student rows gain family and fee fields', () => {
  it('list and detail include familyId, familyName, agreedPrice, planPrice, monthlyFee', async () => {
    const { student, api } = await setup();
    const fam = (await api('POST', '/api/families', { name: 'Família Ana', memberIds: [student.id] })).json();
    const expected = { familyId: fam.id, familyName: 'Família Ana', agreedPrice: '35.00', planPrice: '45.00', monthlyFee: '35.00' };

    const list = (await api('GET', '/api/students')).json();
    expect(list[0]).toMatchObject(expected);
    const one = (await api('GET', `/api/students/${student.id}`)).json();
    expect(one).toMatchObject(expected);
  });

  it('fields are null without membership or family', async () => {
    const { academy, api } = await setup();
    const bare = await createTestUser(academy.id, { name: 'Bare' });
    const one = (await api('GET', `/api/students/${bare.id}`)).json();
    expect(one).toMatchObject({ familyId: null, familyName: null, agreedPrice: null, planPrice: null, monthlyFee: null });
  });
});

describe('PUT /api/students/:id/membership whitelist', () => {
  it('updates allowed fields incl. agreedPrice and ignores others', async () => {
    const { student, api } = await setup();
    const res = await api('PUT', `/api/students/${student.id}/membership`, {
      agreedPrice: '30.00', dueDay: 5, active: false, notificationsMuted: true, studentId: 'x',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ agreedPrice: '30.00', dueDay: 5, active: true, notificationsMuted: false, studentId: student.id });

    const cleared = await api('PUT', `/api/students/${student.id}/membership`, { agreedPrice: null });
    expect(cleared.json().agreedPrice).toBeNull();
  });

  it('rejects an invalid agreedPrice and another academy student', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.api('PUT', `/api/students/${a.student.id}/membership`, { agreedPrice: '-1' })).statusCode).toBe(400);
    expect((await a.api('PUT', `/api/students/${b.student.id}/membership`, { dueDay: 3 })).statusCode).toBe(404);
  });
});

describe('waived months', () => {
  it('creates (idempotent), lists and deletes', async () => {
    const { student, api } = await setup();
    const url = `/api/students/${student.id}/waived-months`;
    expect((await api('POST', url, { month: '2026-09', reason: 'Lesão' })).statusCode).toBe(201);
    const again = await api('POST', url, { month: '2026-09', reason: 'Lesão' });
    expect(again.statusCode).toBe(201);
    expect(again.json()).toEqual({ referenceMonth: '2026-09', reason: 'Lesão' });
    expect((await api('POST', url, { month: '2026-08' })).statusCode).toBe(201);

    const list = (await api('GET', url)).json();
    expect(list).toEqual([
      { referenceMonth: '2026-08', reason: null },
      { referenceMonth: '2026-09', reason: 'Lesão' },
    ]);

    expect((await api('DELETE', `${url}/2026-09`)).statusCode).toBe(204);
    expect((await api('GET', url)).json()).toHaveLength(1);
  });

  it('validates month and academy', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.api('POST', `/api/students/${a.student.id}/waived-months`, { month: '2026-9' })).statusCode).toBe(400);
    expect((await a.api('POST', `/api/students/${b.student.id}/waived-months`, { month: '2026-09' })).statusCode).toBe(404);
    expect((await a.api('GET', `/api/students/${b.student.id}/waived-months`)).statusCode).toBe(404);
    expect((await a.api('DELETE', `/api/students/${b.student.id}/waived-months/2026-09`)).statusCode).toBe(404);
    const asStudent = await app.inject({ method: 'GET', url: `/api/students/${a.student.id}/waived-months`, headers: authHeaders(a.student) });
    expect(asStudent.statusCode).toBe(403);
  });
});

describe('payments use Monthly Fee and Waived Months', () => {
  it('overdue student item has kind and amountDue from the agreed price', async () => {
    const { student, api } = await setup();
    const overdue = (await api('GET', '/api/payments/overdue')).json();
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({
      kind: 'student',
      studentId: student.id,
      studentName: 'Ana',
      phone: '912',
      planName: 'Adults',
      dueDay: 10,
      missedMonths: ['2026-08', '2026-09'],
      referenceMonth: '2026-09',
      amountDue: '70.00',
      daysOverdue: 47,
    });
  });

  it('agreed price 0 is free: not overdue', async () => {
    const { student, api } = await setup();
    await api('PUT', `/api/students/${student.id}/membership`, { agreedPrice: '0.00' });
    expect((await api('GET', '/api/payments/overdue')).json()).toHaveLength(0);
  });

  it('overdue is sorted by daysOverdue desc', async () => {
    const { academy, plan, api } = await setup();
    const older = await createTestUser(academy.id, { name: 'Older' });
    await testDb.insert(schema.studentMembership).values({ studentId: older.id, planId: plan.id, startDate: '2026-06-01', dueDay: 10 });
    const overdue = (await api('GET', '/api/payments/overdue')).json();
    expect(overdue.map((o: any) => o.studentName)).toEqual(['Older', 'Ana']);
  });

  it('waived months are not owed in overdue nor my-status', async () => {
    const { student, api } = await setup();
    await api('POST', `/api/students/${student.id}/waived-months`, { month: '2026-08' });
    await api('POST', `/api/students/${student.id}/waived-months`, { month: '2026-09' });
    expect((await api('GET', '/api/payments/overdue')).json()).toHaveLength(0);
    const status = await app.inject({ method: 'GET', url: '/api/payments/my-status', headers: authHeaders(student) });
    expect(status.json().status).toBe('ok');
  });

  it('my-status is overdue from the oldest owed month', async () => {
    const { student } = await setup();
    const status = await app.inject({ method: 'GET', url: '/api/payments/my-status', headers: authHeaders(student) });
    expect(status.json()).toEqual({ status: 'overdue', daysOverdue: 47 });
  });

  it('quick pay uses the agreed price', async () => {
    const { student, api } = await setup();
    const res = await api('POST', `/api/payments/quick/${student.id}`);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ amount: '35.00', referenceMonth: '2026-09' });
  });

  it('quick pay 404 for another academy student', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.api('POST', `/api/payments/quick/${b.student.id}`)).statusCode).toBe(404);
    const rows = await testDb.select().from(schema.payment).where(eq(schema.payment.studentId, b.student.id));
    expect(rows).toHaveLength(0);
  });
});
