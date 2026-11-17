import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
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

// "No Gi" on Tuesday (Rafael) and Thursday (Bia) share a sheet; "Gi" is the Owner's, "Kids" a guest's.
// October: Marta came twice to No Gi, Carla once (and paid), Diogo only to Gi.
async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id, { name: 'Owner' });
  const rafael = await createTestUser(academy.id, { name: 'Rafael', belt: 'black' });
  const bia = await createTestUser(academy.id, { name: 'Bia', belt: 'black' });
  const marta = await createTestUser(academy.id, { name: 'Marta', belt: 'blue' });
  const carla = await createTestUser(academy.id, { name: 'Carla' });
  const diogo = await createTestUser(academy.id, { name: 'Diogo' });
  for (const s of [marta, carla, diogo]) {
    await testDb
      .insert(schema.studentMembership)
      .values({ studentId: s.id, startDate: '2026-09-01', dueDay: 8, monthlyFee: '45.00' });
  }
  const base = { instructorId: owner.id };
  const noGiTue = await createTestClass(academy.id, { ...base, name: 'No Gi', teacherId: rafael.id, dayOfWeek: 2 });
  const noGiThu = await createTestClass(academy.id, { ...base, name: 'No Gi', teacherId: bia.id, dayOfWeek: 4 });
  const gi = await createTestClass(academy.id, { ...base, name: 'Gi', teacherId: owner.id });
  await createTestClass(academy.id, { ...base, name: 'Kids', guestTeacherName: 'Ana' });
  const seminar = await createTestClass(academy.id, {
    ...base,
    name: 'Leg locks',
    teacherId: rafael.id,
    isSeminar: true,
    recurrence: 'once',
    date: '2026-10-10',
  });
  const checkin = (classId: string, studentId: string, day: number, month = 9) =>
    testDb.insert(schema.checkin).values({ classId, studentId, checkedInAt: new Date(2026, month, day, 19) });
  await checkin(noGiTue.id, marta.id, 6);
  await checkin(noGiThu.id, marta.id, 8);
  await checkin(noGiTue.id, carla.id, 13);
  await checkin(gi.id, diogo.id, 7);
  await checkin(seminar.id, diogo.id, 10);
  await checkin(noGiTue.id, diogo.id, 15, 8); // September
  await testDb.insert(schema.payment).values({
    studentId: carla.id,
    academyId: academy.id,
    amount: '45.00',
    paymentDate: '2026-10-05',
    referenceMonth: '2026-10',
    recordedBy: owner.id,
  });
  const api = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, who: object = owner) =>
    app.inject({ method, url, headers: authHeaders(who), payload });
  return { academy, owner, rafael, bia, marta, carla, diogo, api };
}

const NO_GI = '/api/payout-sheets/2026-10/No%20Gi';

describe('owner payout sheets', () => {
  it('lists one sheet per class name with a teacher other than the Owner and check-ins that month', async () => {
    const { api } = await setup();
    const res = await api('GET', '/api/payout-sheets?month=2026-10');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { className: 'No Gi', teachers: ['Bia', 'Rafael'], students: 2, total: null, status: 'empty' },
    ]);
    expect((await api('GET', '/api/payout-sheets?month=2026-09')).json()).toEqual([
      { className: 'No Gi', teachers: ['Bia', 'Rafael'], students: 1, total: null, status: 'empty' },
    ]);
    expect((await api('GET', '/api/payout-sheets?month=2026-08')).json()).toEqual([]);
    expect((await api('GET', '/api/payout-sheets?month=2026-13')).statusCode).toBe(400);
  });

  it('shows who came, how often, whether they paid and their Monthly Fee, sorted by name', async () => {
    const { api, marta, carla } = await setup();
    const res = await api('GET', NO_GI);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      className: 'No Gi',
      month: '2026-10',
      status: 'empty',
      teachers: ['Bia', 'Rafael'],
      total: null,
      rows: [
        { studentId: carla.id, name: 'Carla', belt: 'white', checkins: 1, paid: true, monthlyFee: '45.00', amount: null, addedByHand: false },
        { studentId: marta.id, name: 'Marta', belt: 'blue', checkins: 2, paid: false, monthlyFee: '45.00', amount: null, addedByHand: false },
      ],
    });
    expect((await api('GET', '/api/payout-sheets/2026-10/Gi')).statusCode).toBe(404);
    expect((await api('GET', '/api/payout-sheets/2026-10/Leg%20locks')).statusCode).toBe(404);
    // A guest-taught class gets a sheet, even before anyone came.
    expect((await api('GET', '/api/payout-sheets/2026-10/Kids')).json()).toMatchObject({ teachers: ['Ana'], rows: [], status: 'empty' });
  });

  it('autosaves amounts, adds and removes Students by hand, confirms and reopens', async () => {
    const { api, marta, carla, diogo } = await setup();
    let res = await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '22.5' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ studentId: marta.id, amount: '22.50', addedByHand: false });
    await api('PUT', `${NO_GI}/lines/${carla.id}`, { amount: '5' });
    expect((await api('GET', NO_GI)).json()).toMatchObject({ status: 'draft', total: '27.50' });

    res = await api('POST', `${NO_GI}/lines`, { studentId: diogo.id });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ studentId: diogo.id, checkins: 0, amount: null, addedByHand: true });
    await api('PUT', `${NO_GI}/lines/${diogo.id}`, { amount: '10' });
    expect((await api('GET', '/api/payout-sheets?month=2026-10')).json()).toEqual([
      { className: 'No Gi', teachers: ['Bia', 'Rafael'], students: 3, total: '37.50', status: 'draft' },
    ]);
    expect((await api('DELETE', `${NO_GI}/lines/${marta.id}`)).statusCode).toBe(404);
    expect((await api('DELETE', `${NO_GI}/lines/${diogo.id}`)).statusCode).toBe(204);

    // Clearing an amount leaves the line empty.
    await api('PUT', `${NO_GI}/lines/${carla.id}`, { amount: null });
    expect((await api('GET', NO_GI)).json()).toMatchObject({ total: '22.50', rows: [{ amount: null }, { amount: '22.50' }] });

    res = await api('POST', `${NO_GI}/confirm`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'confirmed', total: '22.50' });
    for (const write of [
      api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '1' }),
      api('POST', `${NO_GI}/lines`, { studentId: diogo.id }),
      api('DELETE', `${NO_GI}/lines/${diogo.id}`),
    ]) {
      const r = await write;
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ error: 'sheetConfirmed' });
    }
    expect((await api('POST', `${NO_GI}/reopen`)).json()).toMatchObject({ status: 'draft' });
    expect((await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '1' })).statusCode).toBe(200);
  });

  it('lists a class without check-ins once it has a sheet, and keeps academies apart', async () => {
    const { api, diogo } = await setup();
    await api('POST', '/api/payout-sheets/2026-10/Kids/lines', { studentId: diogo.id });
    expect((await api('GET', '/api/payout-sheets?month=2026-10')).json().map((s: any) => s.className)).toEqual([
      'Kids',
      'No Gi',
    ]);
    const other = await createTestOwner((await createTestAcademy()).id);
    expect((await api('GET', '/api/payout-sheets?month=2026-10', undefined, other)).json()).toEqual([]);
    expect((await api('GET', NO_GI, undefined, other)).statusCode).toBe(404);
  });

  it('validates input and is owner only', async () => {
    const { api, marta, diogo } = await setup();
    expect((await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '-1' })).statusCode).toBe(400);
    expect((await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: 'abc' })).statusCode).toBe(400);
    // Diogo is not on the sheet until added by hand.
    expect((await api('PUT', `${NO_GI}/lines/${diogo.id}`, { amount: '1' })).statusCode).toBe(404);
    expect((await api('POST', `${NO_GI}/lines`, { studentId: 'nope' })).statusCode).toBe(404);
    const stranger = await createTestUser((await createTestAcademy()).id);
    expect((await api('POST', `${NO_GI}/lines`, { studentId: stranger.id })).statusCode).toBe(404);
    expect((await api('PUT', `/api/payout-sheets/2026-10/Gi/lines/${marta.id}`, { amount: '1' })).statusCode).toBe(404);
    expect((await api('GET', NO_GI, undefined, marta)).statusCode).toBe(403);
  });

  it('gives each of the last months its class totals and whether all were confirmed', async () => {
    const { api, marta, diogo } = await setup();
    await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '20' });
    await api('POST', `${NO_GI}/confirm`);
    await api('PUT', `/api/payout-sheets/2026-09/No%20Gi/lines/${diogo.id}`, { amount: '7' });
    const res = await api('GET', '/api/payout-sheets/history?months=3');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { month: '2026-10', classes: [{ className: 'No Gi', total: '20.00' }], confirmed: true },
      { month: '2026-09', classes: [{ className: 'No Gi', total: '7.00' }], confirmed: false },
      { month: '2026-08', classes: [], confirmed: false },
    ]);
    expect((await api('GET', '/api/payout-sheets/history')).json()).toHaveLength(6);
  });
});

describe('teacher payout sheets', () => {
  it('lists the class names a teacher teaches with the last 6 months', async () => {
    const { api, rafael, marta } = await setup();
    await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '20' });
    const res = await api('GET', '/api/me/payout-sheets', undefined, rafael);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        className: 'No Gi',
        history: [
          { month: '2026-10', total: '20.00', confirmed: false },
          { month: '2026-09', total: null, confirmed: false },
          { month: '2026-08', total: null, confirmed: false },
          { month: '2026-07', total: null, confirmed: false },
          { month: '2026-06', total: null, confirmed: false },
          { month: '2026-05', total: null, confirmed: false },
        ],
      },
    ]);
    expect((await api('GET', '/api/me/payout-sheets', undefined, marta)).json()).toEqual([]);
  });

  it("shows the sheet read-only without anyone's Monthly Fee, only to its teachers", async () => {
    const { api, bia, marta, carla } = await setup();
    await api('PUT', `${NO_GI}/lines/${marta.id}`, { amount: '20' });
    const url = '/api/me/payout-sheets/2026-10/No%20Gi';
    const res = await api('GET', url, undefined, bia);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      className: 'No Gi',
      month: '2026-10',
      status: 'draft',
      teachers: ['Bia', 'Rafael'],
      total: '20.00',
      rows: [
        { studentId: carla.id, name: 'Carla', belt: 'white', checkins: 1, paid: true, amount: null, addedByHand: false },
        { studentId: marta.id, name: 'Marta', belt: 'blue', checkins: 2, paid: false, amount: '20.00', addedByHand: false },
      ],
    });
    expect((await api('GET', url, undefined, marta)).statusCode).toBe(403);
    expect((await api('GET', '/api/me/payout-sheets/2026-10/Kids', undefined, bia)).statusCode).toBe(403);
  });

  it('answers for the Dependent profile a Responsible is acting as', async () => {
    const { academy, rafael } = await setup();
    const parent = await createTestUser(academy.id, { name: 'Pai', role: 'responsible' });
    const [fam] = await testDb
      .insert(schema.family)
      .values({ academyId: academy.id, name: 'Família R', responsibleUserId: parent.id })
      .returning();
    await testDb.update(schema.user).set({ familyId: fam.id }).where(eq(schema.user.id, rafael.id));
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/payout-sheets',
      headers: { ...authHeaders(parent), 'x-acting-as': rafael.id },
    });
    expect(res.json()).toHaveLength(1);
  });
});
