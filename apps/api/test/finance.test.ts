import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
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

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const rafael = await createTestUser(academy.id, {
    name: 'Rafael',
    belt: 'brown',
  });
  const marta = await createTestUser(academy.id, {
    name: 'Marta',
    phone: '911',
  });
  const carla = await createTestUser(academy.id, { name: 'Carla' });
  const diogo = await createTestUser(academy.id, { name: 'Diogo' });
  for (const s of [marta, carla, diogo]) {
    await testDb.insert(schema.studentMembership).values({
      studentId: s.id,
      startDate: '2026-09-01',
      dueDay: 8,
      monthlyFee: '45.00',
    });
  }
  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }
  function pay(studentId: string, amount: string, paymentDate: string, referenceMonth: string) {
    return testDb.insert(schema.payment).values({
      studentId,
      academyId: academy.id,
      amount,
      paymentDate,
      referenceMonth,
      recordedBy: owner.id,
    });
  }
  return { academy, owner, rafael, marta, carla, diogo, api, pay };
}
describe('expenses', () => {
  it('adds, edits and removes rows of a month', async () => {
    const { api } = await setup();
    expect((await api('GET', '/api/finance/expenses?month=2026-09')).json()).toEqual({
      month: '2026-09',
      expenses: [],
    });
    const rent = await api('POST', '/api/finance/expenses', {
      month: '2026-09',
      description: 'Renda',
      amount: '1200',
    });
    expect(rent.statusCode).toBe(201);
    expect(rent.json()).toMatchObject({
      description: 'Renda',
      amount: '1200.00',
      oneOff: false,
      confirmed: true,
    });

    const edited = await api('PUT', `/api/finance/expenses/${rent.json().id}`, {
      amount: '1250.50',
    });
    expect(edited.json()).toMatchObject({ amount: '1250.50', confirmed: true });

    expect((await api('DELETE', `/api/finance/expenses/${rent.json().id}`)).statusCode).toBe(204);
    expect((await api('GET', '/api/finance/expenses?month=2026-09')).json().expenses).toEqual([]);
  });

  it('starts an empty month from the latest earlier month, except one-off rows, greyed until confirmed', async () => {
    const { api } = await setup();
    await api('POST', '/api/finance/expenses', {
      month: '2026-09',
      description: 'Renda',
      amount: '1200',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-09',
      description: 'Luz',
      amount: '87.40',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-09',
      description: 'Tatame novo',
      amount: '340',
      oneOff: true,
    });

    const oct = (await api('GET', '/api/finance/expenses?month=2026-10')).json();
    expect(oct.expenses.map((e: any) => [e.description, e.amount, e.confirmed, e.oneOff])).toEqual([
      ['Renda', '1200.00', false, false],
      ['Luz', '87.40', false, false],
    ]);
    // Opening it again does not copy twice.
    expect((await api('GET', '/api/finance/expenses?month=2026-10')).json().expenses).toHaveLength(2);

    const luz = oct.expenses[1];
    expect((await api('PUT', `/api/finance/expenses/${luz.id}`, { amount: '94.10' })).json()).toMatchObject({
      amount: '94.10',
      confirmed: true,
    });
    // Confirming without a change.
    expect((await api('PUT', `/api/finance/expenses/${oct.expenses[0].id}`, {})).json()).toMatchObject({
      amount: '1200.00',
      confirmed: true,
    });

    // A gap: December starts from October (November was never opened).
    const dec = (await api('GET', '/api/finance/expenses?month=2026-12')).json();
    expect(dec.expenses.map((e: any) => e.amount)).toEqual(['1200.00', '94.10']);
    // Earlier months are not filled from later ones.
    expect((await api('GET', '/api/finance/expenses?month=2026-08')).json().expenses).toEqual([]);
  });

  it('validates input and keeps academies apart', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.api('GET', '/api/finance/expenses?month=2026-9')).statusCode).toBe(400);
    expect(
      (
        await a.api('POST', '/api/finance/expenses', {
          month: '2026-09',
          description: ' ',
          amount: '1',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await a.api('POST', '/api/finance/expenses', {
          month: '2026-09',
          description: 'X',
          amount: 'abc',
        })
      ).statusCode,
    ).toBe(400);
    const row = (
      await b.api('POST', '/api/finance/expenses', {
        month: '2026-09',
        description: 'B',
        amount: '1',
      })
    ).json();
    expect((await a.api('PUT', `/api/finance/expenses/${row.id}`, { amount: '2' })).statusCode).toBe(404);
    expect((await a.api('DELETE', `/api/finance/expenses/${row.id}`)).statusCode).toBe(404);
    expect((await a.api('GET', '/api/finance/expenses?month=2026-10')).json().expenses).toEqual([]);
    const asStudent = await app.inject({
      method: 'GET',
      url: '/api/finance/expenses?month=2026-09',
      headers: authHeaders(a.marta),
    });
    expect(asStudent.statusCode).toBe(403);
  });
});

describe('monthly balance', () => {
  it('adds money paid that month, subtracts expenses and payouts', async () => {
    const { api, academy, owner, rafael, marta, carla, pay } = await setup();
    await pay(marta.id, '55.00', '2026-10-05', '2026-10');
    await pay(carla.id, '45.00', '2026-10-02', '2026-09');
    await pay(carla.id, '45.00', '2026-09-02', '2026-08');
    const noGi = await createTestClass(academy.id, { instructorId: owner.id, name: 'No Gi', teacherId: rafael.id });
    await testDb.insert(schema.checkin).values([
      { classId: noGi.id, studentId: marta.id, checkedInAt: new Date(2026, 9, 6, 19) },
      { classId: noGi.id, studentId: carla.id, checkedInAt: new Date(2026, 8, 8, 19) },
    ]);
    await api('PUT', `/api/payout-sheets/2026-10/No%20Gi/lines/${marta.id}`, { amount: '27.50' });
    await api('PUT', `/api/payout-sheets/2026-09/No%20Gi/lines/${carla.id}`, { amount: '22.50' });
    await api('POST', '/api/payout-sheets/2026-09/No%20Gi/confirm');
    const seminar = await createTestClass(academy.id, {
      instructorId: owner.id,
      isSeminar: true,
      recurrence: 'once',
      date: '2026-10-10',
    });
    await testDb.insert(schema.seminarParticipant).values([
      {
        classId: seminar.id,
        name: 'Fora',
        amount: '30.00',
        paidAt: '2026-10-10',
      },
      { classId: seminar.id, name: 'Pendente', amount: '30.00' },
      {
        classId: seminar.id,
        studentId: marta.id,
        amount: '20.00',
        paidAt: '2026-09-28',
      },
    ]);
    await api('POST', '/api/finance/expenses', {
      month: '2026-10',
      description: 'Renda',
      amount: '1200',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-10',
      description: 'Luz',
      amount: '94.10',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-10',
      description: 'Água',
      amount: '30',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-10',
      description: 'Internet',
      amount: '35',
    });
    await api('POST', '/api/finance/expenses', {
      month: '2026-10',
      description: 'Limpeza',
      amount: '20',
    });

    const res = await api('GET', '/api/finance/balance?month=2026-10');
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b).toMatchObject({
      month: '2026-10',
      income: {
        monthlyFees: { amount: '100.00', students: 2 },
        seminars: { amount: '30.00', count: 1 },
        total: '130.00',
      },
      expenses: {
        total: '1379.10',
        // Largest first.
        items: [
          { description: 'Renda', amount: '1200.00' },
          { description: 'Luz', amount: '94.10' },
          { description: 'Internet', amount: '35.00' },
          { description: 'Água', amount: '30.00' },
          { description: 'Limpeza', amount: '20.00' },
        ],
      },
      // A draft Payout Sheet is only pending.
      payouts: { total: '0.00', pending: '27.50' },
      result: '-1249.10',
    });
    expect(b.history.map((h: any) => h.month)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(b.history[4]).toEqual({ month: '2026-09', result: '42.50' }); // 45 + 20 seminar − 22.50 payout
    expect(b.history[5]).toEqual({ month: '2026-10', result: '-1249.10' });

    await api('POST', '/api/payout-sheets/2026-10/No%20Gi/confirm');
    const confirmed = (await api('GET', '/api/finance/balance?month=2026-10')).json();
    expect(confirmed.payouts).toEqual({ total: '27.50', pending: '0.00' });
    expect(confirmed.result).toBe('-1276.60');
  });

  it('does not copy expenses when only reading the balance, and is owner only', async () => {
    const { api, marta } = await setup();
    await api('POST', '/api/finance/expenses', {
      month: '2026-09',
      description: 'Renda',
      amount: '1200',
    });
    const b = (await api('GET', '/api/finance/balance?month=2026-10')).json();
    expect(b.expenses).toEqual({ total: '0.00', items: [] });
    expect((await api('GET', '/api/finance/expenses?month=2026-10')).json().expenses).toHaveLength(1);
    expect((await api('GET', '/api/finance/balance?month=10')).statusCode).toBe(400);
    const asStudent = await app.inject({
      method: 'GET',
      url: '/api/finance/balance?month=2026-10',
      headers: authHeaders(marta),
    });
    expect(asStudent.statusCode).toBe(403);
  });
});
