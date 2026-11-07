import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';
import { auth } from '../src/auth/index';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  return () => vi.useRealTimers();
});

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, who: any, payload?: object) =>
  app.inject({ method, url, headers: authHeaders(who), ...(payload ? { payload } : {}) });

async function setup() {
  const a = await createTestAcademy();
  const b = await createTestAcademy();
  const ownerA = await createTestOwner(a.id);
  const ownerB = await createTestOwner(b.id);
  const s = await createTestUser(a.id, { name: 'Mover' });
  await testDb.insert(schema.studentMembership).values({ studentId: s.id, monthlyFee: '50.00', dueDay: 1, startDate: '2026-10-01', active: true });
  await testDb.insert(schema.payment).values({ studentId: s.id, academyId: a.id, amount: '50.00', paymentDate: '2026-10-02', referenceMonth: '2026-10', recordedBy: ownerA.id });
  await call('POST', `/api/students/${s.id}/waived-months`, ownerA, { month: '2026-11' });
  return { a, b, ownerA, ownerB, s };
}

describe('billing state belongs to an academy', () => {
  it('joining another academy ends the old membership and family link', async () => {
    const { a, b, s } = await setup();
    const resp = await createTestUser(a.id, { name: 'Resp' });
    const [fam] = await testDb.insert(schema.family).values({ academyId: a.id, name: 'F', responsibleUserId: resp.id }).returning();
    await testDb.update(schema.user).set({ familyId: fam.id }).where(eq(schema.user.id, s.id));

    expect((await call('POST', `/api/academies/${b.id}/join`, s)).statusCode).toBe(200);

    const [u] = await testDb.select().from(schema.user).where(eq(schema.user.id, s.id));
    expect(u.familyId).toBeNull();
    const active = await testDb.select().from(schema.studentMembership)
      .where(and(eq(schema.studentMembership.studentId, s.id), eq(schema.studentMembership.active, true)));
    expect(active).toHaveLength(0);
  });

  it('the new academy does not count the old academy’s payments or waivers', async () => {
    const { b, ownerB, s } = await setup();
    await call('POST', `/api/academies/${b.id}/join`, s);
    await testDb.update(schema.user).set({ status: 'active' }).where(eq(schema.user.id, s.id));
    const put = await call('PUT', `/api/students/${s.id}/membership`, ownerB, { monthlyFee: '60.00', dueDay: 1, startDate: '2026-10-01' });
    expect(put.statusCode).toBe(200);

    const overdue = (await call('GET', '/api/payments/overdue', ownerB)).json();
    const item = overdue.find((o: any) => o.studentId === s.id);
    expect(item).toBeDefined();
    expect(item.missedMonths).toEqual(expect.arrayContaining(['2026-10', '2026-11']));
  });

  it('the new academy can waive a month the old one waived', async () => {
    const { b, ownerB, s } = await setup();
    await call('POST', `/api/academies/${b.id}/join`, s);
    expect((await call('GET', `/api/students/${s.id}/waived-months`, ownerB)).json()).toEqual([]);
    const res = await call('POST', `/api/students/${s.id}/waived-months`, ownerB, { month: '2026-11' });
    expect(res.statusCode).toBe(201);
    const list = (await call('GET', `/api/students/${s.id}/waived-months`, ownerB)).json();
    expect(list.map((w: any) => w.referenceMonth)).toEqual(['2026-11']);
  });

  it('the new owner does not see the old academy’s payment history', async () => {
    const { b, ownerB, s } = await setup();
    await call('POST', `/api/academies/${b.id}/join`, s);
    const res = await call('GET', `/api/payments/student/${s.id}`, ownerB);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('rejoining the same academy keeps the membership', async () => {
    const { a, s } = await setup();
    await call('POST', `/api/academies/${a.id}/join`, s);
    const active = await testDb.select().from(schema.studentMembership)
      .where(and(eq(schema.studentMembership.studentId, s.id), eq(schema.studentMembership.active, true)));
    expect(active).toHaveLength(1);
  });

  it('a family’s Responsible must hand over before leaving the academy', async () => {
    const { a, b } = await setup();
    const resp = await createTestUser(a.id, { name: 'Resp' });
    await testDb.insert(schema.family).values({ academyId: a.id, name: 'F', responsibleUserId: resp.id });
    const res = await call('POST', `/api/academies/${b.id}/join`, resp);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RESPONSIBLE_OF_FAMILY');
    const created = await call('POST', '/api/academies', resp, { name: 'New', city: 'X' });
    expect(created.statusCode).toBe(409);
  });
});

describe('auth proxy client IP', () => {
  it('replaces a spoofed X-Forwarded-For before better-auth sees it', async () => {
    const spy = vi.spyOn(auth, 'handler').mockResolvedValue(new Response('{}', { status: 200 }));
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'http://localhost:5173', 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'fly-client-ip': '198.51.100.9', 'content-type': 'application/json' },
      payload: '{}',
    });
    const req = spy.mock.calls[0][0] as Request;
    expect(req.headers.get('x-forwarded-for')).toBe('198.51.100.9');
    expect(req.headers.get('x-origin-secret')).toBeNull();
    spy.mockRestore();
  });
});
