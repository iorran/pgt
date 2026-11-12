import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 2026-10-20
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => {
  await cleanDb();
});

// "No Gi" (Rafael) has Marta as add-on and Carla as recruited; "Gi" (Bia) has Diogo. Only Carla paid in October.
async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const rafael = await createTestUser(academy.id, { name: 'Rafael', belt: 'black' });
  const bia = await createTestUser(academy.id, { name: 'Bia', belt: 'black' });
  const marta = await createTestUser(academy.id, { name: 'Marta' });
  const carla = await createTestUser(academy.id, { name: 'Carla' });
  const diogo = await createTestUser(academy.id, { name: 'Diogo' });
  for (const s of [marta, carla, diogo]) {
    await testDb
      .insert(schema.studentMembership)
      .values({ studentId: s.id, startDate: '2026-09-01', dueDay: 8, monthlyFee: '45.00' });
  }
  const asOwner = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, headers: authHeaders(owner), payload });
  const noGi = (
    await asOwner('POST', '/api/agreements', { name: 'No Gi', sharePercent: 50, addOnPrice: '10', teacherIds: [rafael.id] })
  ).json();
  const gi = (await asOwner('POST', '/api/agreements', { name: 'Gi', sharePercent: 30, teacherIds: [bia.id] })).json();
  await asOwner('PUT', `/api/students/${marta.id}/finance`, { agreementId: noGi.id, kind: 'addOn' });
  await asOwner('PUT', `/api/students/${carla.id}/finance`, { agreementId: noGi.id, kind: 'recruited' });
  await asOwner('PUT', `/api/students/${diogo.id}/finance`, { agreementId: gi.id, kind: 'recruited' });
  await testDb.insert(schema.payment).values({
    studentId: carla.id,
    academyId: academy.id,
    amount: '45.00',
    paymentDate: '2026-10-05',
    referenceMonth: '2026-10',
    recordedBy: owner.id,
  });
  const mine = (who: object, month = '2026-10') =>
    app.inject({ method: 'GET', url: `/api/me/agreements?month=${month}`, headers: authHeaders(who) });
  return { academy, owner, rafael, bia, marta, carla, diogo, noGi, gi, asOwner, mine };
}

describe('GET /api/me/agreements', () => {
  it('shows a teacher only their own agreement, with no amounts', async () => {
    const { rafael, marta, carla, noGi, mine } = await setup();
    const res = await mine(rafael);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        agreement: { id: noGi.id, name: 'No Gi', teachers: [{ id: rafael.id, name: 'Rafael' }] },
        month: '2026-10',
        confirmed: null,
        students: [
          { studentId: marta.id, name: 'Marta', kind: 'addOn', checkins: 0, paid: false },
          { studentId: carla.id, name: 'Carla', kind: 'recruited', checkins: 0, paid: true },
        ],
      },
    ]);
  });

  it('shows the payout total only once the Owner confirmed it', async () => {
    const { rafael, noGi, asOwner, mine } = await setup();
    expect((await mine(rafael)).json()[0].confirmed).toBeNull();
    await asOwner('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '27.50' });
    expect((await mine(rafael)).json()[0].confirmed).toBe('27.50');
    expect((await mine(rafael, '2026-09')).json()[0].confirmed).toBeNull();
  });

  it('gives nothing to students who teach no agreement', async () => {
    const { marta, mine } = await setup();
    const res = await mine(marta);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('never leaks another academy', async () => {
    const { rafael, mine } = await setup();
    const other = await createTestAcademy();
    // Same teacher id but logged in under another academy sees nothing.
    expect((await mine({ ...rafael, academyId: other.id })).json()).toEqual([]);
  });

  it('answers for the Dependent profile a Responsible is acting as', async () => {
    const { academy, rafael, mine } = await setup();
    const parent = await createTestUser(academy.id, { name: 'Pai', role: 'responsible' });
    const [fam] = await testDb
      .insert(schema.family)
      .values({ academyId: academy.id, name: 'Família R', responsibleUserId: parent.id })
      .returning();
    await testDb.update(schema.user).set({ familyId: fam.id }).where(eq(schema.user.id, rafael.id));
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/agreements?month=2026-10',
      headers: { ...authHeaders(parent), 'x-acting-as': rafael.id },
    });
    expect(res.json()).toHaveLength(1);
    expect((await mine(parent)).json()).toEqual([]);
  });

  it('rejects a bad month', async () => {
    const { rafael, mine } = await setup();
    expect((await mine(rafael, '2026-13')).statusCode).toBe(400);
  });
});
