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

// "No Gi" agreement with Rafael (50%, add-on 10 €). Marta: its Class Add-on. Carla and Diogo: recruited by it.
async function setupMarked() {
  const ctx = await setup();
  const { api, rafael, marta, carla, diogo } = ctx;
  const created = await api('POST', '/api/agreements', {
    name: 'No Gi',
    sharePercent: 50,
    addOnPrice: '10',
    teacherIds: [rafael.id],
  });
  expect(created.statusCode).toBe(201);
  const noGi = created.json();
  expect((await api('PUT', `/api/students/${marta.id}/finance`, { agreementId: noGi.id, kind: 'addOn' })).statusCode).toBe(200);
  for (const s of [carla, diogo]) {
    expect((await api('PUT', `/api/students/${s.id}/finance`, { agreementId: noGi.id, kind: 'recruited' })).statusCode).toBe(200);
  }
  return { ...ctx, noGi };
}

describe('what a Student owes includes the Class Add-on of their agreement', () => {
  it('overdue list, quick payment and my-status use Monthly Fee + add-on price', async () => {
    const { api, noGi, marta, carla } = await setupMarked();
    const overdue = (await api('GET', '/api/payments/overdue')).json();
    const martaItem = overdue.find((i: any) => i.studentId === marta.id);
    expect(martaItem).toMatchObject({
      missedMonths: ['2026-09', '2026-10'],
      amountDue: '110.00',
      monthlyFee: '45.00',
      addOn: { name: 'No Gi', price: '10.00' },
      recruitedBy: null,
    });
    const carlaItem = overdue.find((i: any) => i.studentId === carla.id);
    expect(carlaItem).toMatchObject({
      amountDue: '90.00',
      addOn: null,
      recruitedBy: { id: noGi.id, name: 'No Gi' },
    });

    const status = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(marta),
    });
    expect(status.json()).toMatchObject({
      status: 'overdue',
      monthlyFee: '45.00',
      addOn: { name: 'No Gi', price: '10.00' },
    });

    const quick = await api('POST', `/api/payments/quick/${marta.id}`);
    expect(quick.json()).toMatchObject({
      amount: '55.00',
      referenceMonth: '2026-09',
    });
  });

  it('follows the agreement add-on price and stops when unlinked', async () => {
    const { api, noGi, rafael, marta } = await setupMarked();
    expect(
      (await api('PUT', `/api/agreements/${noGi.id}`, { name: 'No Gi', sharePercent: 50, addOnPrice: '12', teacherIds: [rafael.id] }))
        .statusCode,
    ).toBe(200);
    let item = (await api('GET', '/api/payments/overdue')).json().find((i: any) => i.studentId === marta.id);
    expect(item.amountDue).toBe('114.00');

    await api('PUT', `/api/students/${marta.id}/finance`, { agreementId: null, kind: null });
    item = (await api('GET', '/api/payments/overdue')).json().find((i: any) => i.studentId === marta.id);
    expect(item).toMatchObject({ amountDue: '90.00', addOn: null });
  });

  it('adds to the Family Fee sum; a Family Agreed Price still overrides it', async () => {
    const { api, marta, carla } = await setupMarked();
    const fam = (
      await api('POST', '/api/families', {
        name: 'Família M',
        responsibleId: marta.id,
        memberIds: [marta.id, carla.id],
      })
    ).json();
    let billing = (await api('GET', `/api/families/${fam.id}/billing`)).json();
    expect(billing.owedMonths[0]).toMatchObject({
      month: '2026-09',
      fee: '100.00',
    });
    expect(billing.suggestedAmount).toBe('200.00');

    await api('PUT', `/api/families/${fam.id}`, { agreedPrice: '80.00' });
    billing = (await api('GET', `/api/families/${fam.id}/billing`)).json();
    expect(billing.owedMonths[0].fee).toBe('80.00');
  });
});

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

describe('teacher payouts', () => {
  async function octoberPayments() {
    const ctx = await setupMarked();
    const { marta, carla, pay } = ctx;
    await pay(marta.id, '55.00', '2026-10-05', '2026-10');
    // Counts in the month it was paid, not the month it refers to.
    await pay(carla.id, '45.00', '2026-10-02', '2026-09');
    await pay(carla.id, '45.00', '2026-11-01', '2026-10');
    return ctx;
  }

  it("suggests the agreement's % of each add-on payment plus the same % of what Recruited Students paid", async () => {
    const { api, noGi, rafael, marta, carla, diogo } = await octoberPayments();
    const res = await api('GET', '/api/finance/payouts?month=2026-10');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    const [p] = res.json();
    expect(p).toMatchObject({
      agreement: { id: noGi.id, name: 'No Gi', sharePercent: 50, teachers: [{ id: rafael.id, name: 'Rafael' }] },
      addOn: { count: 1, price: '10.00', share: '5.00', amount: '5.00' },
      recruited: { paid: '45.00', percent: 50, amount: '22.50' },
      suggested: '27.50',
      confirmed: null,
      amount: '27.50',
      missingCheckins: ['Marta'],
      walkIns: [],
    });
    expect(p.students).toEqual([
      {
        studentId: marta.id,
        name: 'Marta',
        kind: 'addOn',
        monthlyFee: '45.00',
        checkins: 0,
        paid: '55.00',
        payout: '5.00',
        payments: [{ amount: '55.00', paymentDate: '2026-10-05', referenceMonth: '2026-10', payout: '5.00' }],
      },
      {
        studentId: carla.id,
        name: 'Carla',
        kind: 'recruited',
        monthlyFee: '45.00',
        checkins: 0,
        paid: '45.00',
        payout: '22.50',
        payments: [{ amount: '45.00', paymentDate: '2026-10-02', referenceMonth: '2026-09', payout: '22.50' }],
      },
      {
        studentId: diogo.id,
        name: 'Diogo',
        kind: 'recruited',
        monthlyFee: '45.00',
        checkins: 0,
        paid: '0.00',
        payout: '0.00',
        payments: [],
      },
    ]);
  });

  it("counts check-ins in any agreement teacher's classes; warns about add-on Students without; lists walk-ins", async () => {
    const { api, academy, owner, rafael, marta, carla } = await octoberPayments();
    const alex = await createTestUser(academy.id, { name: 'Alex' });
    const bruno = await createTestUser(academy.id, { name: 'Bruno' });
    const [p0] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    await api('PUT', `/api/agreements/${p0.agreement.id}`, {
      name: 'No Gi',
      sharePercent: 50,
      addOnPrice: '10',
      teacherIds: [rafael.id, alex.id],
    });
    const noGi = await createTestClass(academy.id, { teacherId: alex.id, type: 'no-gi', instructorId: owner.id });
    const gi = await createTestClass(academy.id, { instructorId: owner.id });
    await testDb.insert(schema.checkin).values([
      { classId: gi.id, studentId: marta.id, checkedInAt: new Date(2026, 9, 3, 19) },
      { classId: noGi.id, studentId: marta.id, checkedInAt: new Date(2026, 8, 30, 19) },
    ]);
    let [p] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    expect(p.missingCheckins).toEqual(['Marta']);

    await testDb.insert(schema.checkin).values([
      { classId: noGi.id, studentId: marta.id, checkedInAt: new Date(2026, 9, 7, 19) },
      { classId: noGi.id, studentId: carla.id, checkedInAt: new Date(2026, 9, 7, 19) },
      { classId: noGi.id, studentId: bruno.id, checkedInAt: new Date(2026, 9, 7, 19) },
      { classId: noGi.id, studentId: bruno.id, checkedInAt: new Date(2026, 9, 14, 19) },
      { classId: noGi.id, studentId: rafael.id, checkedInAt: new Date(2026, 9, 14, 19) },
    ]);
    [p] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    expect(p.missingCheckins).toEqual([]);
    expect(p.students.map((s: any) => s.checkins)).toEqual([1, 1, 0]);
    // Came to the agreement's classes without being linked to it; its own teachers never count.
    expect(p.walkIns).toEqual([{ studentId: bruno.id, name: 'Bruno', checkins: 2 }]);
    // A check-in never changes the money.
    expect(p.suggested).toBe('27.50');
  });

  it('keeps the amount the Owner confirms', async () => {
    const { api, noGi } = await octoberPayments();
    const res = await api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '30' });
    expect(res.statusCode).toBe(200);
    let [p] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    expect(p).toMatchObject({ suggested: '27.50', confirmed: '30.00', amount: '30.00' });

    await api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '27.50' });
    [p] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    expect(p.confirmed).toBe('27.50');

    expect((await api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '-1' })).statusCode).toBe(400);
    expect((await api('POST', '/api/finance/payouts', { agreementId: 'nope', month: '2026-10', amount: '1' })).statusCode).toBe(400);
    const other = await setup();
    expect(
      (await other.api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '1' })).statusCode,
    ).toBe(400);
  });

  it("uses the agreement's percentage and lists no agreement without Students", async () => {
    const { api, noGi, rafael } = await octoberPayments();
    await api('PUT', `/api/agreements/${noGi.id}`, { name: 'No Gi', sharePercent: 40, addOnPrice: '10', teacherIds: [rafael.id] });
    const [p] = (await api('GET', '/api/finance/payouts?month=2026-10')).json();
    expect(p).toMatchObject({
      addOn: { share: '4.00', amount: '4.00' },
      recruited: { amount: '18.00' },
      suggested: '22.00',
    });

    const other = await setup();
    await other.api('POST', '/api/agreements', { name: 'Vazio', sharePercent: 50, addOnPrice: null, teacherIds: [other.rafael.id] });
    expect((await other.api('GET', '/api/finance/payouts?month=2026-10')).json()).toEqual([]);
  });

  it('keeps an ended agreement in months it has a confirmed payout', async () => {
    const { api, noGi } = await octoberPayments();
    await api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '27.50' });
    expect((await api('POST', `/api/agreements/${noGi.id}/end`)).statusCode).toBe(200);
    expect((await api('GET', '/api/finance/payouts?month=2026-10')).json()).toMatchObject([
      { agreement: { id: noGi.id }, confirmed: '27.50', amount: '27.50' },
    ]);
    expect((await api('GET', '/api/finance/payouts?month=2026-11')).json()).toEqual([]);
  });
});

describe('monthly balance', () => {
  it('adds money paid that month, subtracts expenses and payouts', async () => {
    const { api, academy, owner, noGi, marta, carla, pay } = await setupMarked();
    await pay(marta.id, '55.00', '2026-10-05', '2026-10');
    await pay(carla.id, '45.00', '2026-10-02', '2026-09');
    await pay(carla.id, '45.00', '2026-09-02', '2026-08');
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
        monthlyFees: { amount: '90.00', students: 2 },
        addOns: { amount: '10.00', count: 1 },
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
      // Not confirmed: the suggestion (5.00 add-on share + 22.50 recruited).
      payouts: { total: '27.50' },
      result: '-1276.60',
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
    expect(b.history[5]).toEqual({ month: '2026-10', result: '-1276.60' });

    await api('POST', '/api/finance/payouts', { agreementId: noGi.id, month: '2026-10', amount: '40' });
    const confirmed = (await api('GET', '/api/finance/balance?month=2026-10')).json();
    expect(confirmed.payouts.total).toBe('40.00');
    expect(confirmed.result).toBe('-1289.10');
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
