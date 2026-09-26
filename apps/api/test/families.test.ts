import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  // Only Date is faked so timers used by the DB driver keep working. "Today" = 2026-09-26.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 26, 12));
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => { await cleanDb(); });

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const [plan35] = await testDb.insert(schema.membershipPlan).values({
    academyId: academy.id, name: 'Kids', price: '35.00', frequency: 'monthly',
  }).returning();
  const [plan45] = await testDb.insert(schema.membershipPlan).values({
    academyId: academy.id, name: 'Adults', price: '45.00', frequency: 'monthly',
  }).returning();

  async function student(
    name: string,
    planId: string,
    opts: { phone?: string; agreedPrice?: string; startDate?: string; dueDay?: number } = {},
  ) {
    const s = await createTestUser(academy.id, { name, phone: opts.phone ?? null });
    await testDb.insert(schema.studentMembership).values({
      studentId: s.id,
      planId,
      startDate: opts.startDate ?? '2026-08-01',
      dueDay: opts.dueDay ?? 10,
      agreedPrice: opts.agreedPrice ?? null,
    });
    return s;
  }

  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }

  return { academy, owner, plan35, plan45, student, api };
}

async function paymentsOf(studentId: string) {
  return testDb.select().from(schema.payment).where(eq(schema.payment.studentId, studentId));
}

describe('families CRUD', () => {
  it('creates a family and returns it with members, fees and familyFee', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id, { phone: '911' });
    const leo = await student('Leo', plan35.id, { agreedPrice: '30.00' });

    const res = await api('POST', '/api/families', { name: 'Família Silva', memberIds: [bia.id, leo.id], contactStudentId: leo.id });
    expect(res.statusCode).toBe(201);
    const fam = res.json();
    expect(fam).toMatchObject({
      name: 'Família Silva',
      contactStudentId: leo.id,
      agreedPrice: null,
      priceReviewNeeded: false,
      familyFee: '65.00',
    });
    expect(fam.members).toHaveLength(2);
    expect(fam.members.find((m: any) => m.id === bia.id)).toEqual({ id: bia.id, name: 'Bia', phone: '911', belt: 'white', monthlyFee: '35.00' });
    expect(fam.members.find((m: any) => m.id === leo.id).monthlyFee).toBe('30.00');

    const [row] = await testDb.select().from(schema.user).where(eq(schema.user.id, bia.id));
    expect(row.familyId).toBe(fam.id);

    const list = await api('GET', '/api/families');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const one = await api('GET', `/api/families/${fam.id}`);
    expect(one.statusCode).toBe(200);
    expect(one.json().id).toBe(fam.id);
  });

  it('member without membership has monthlyFee null', async () => {
    const { academy, api } = await setup();
    const kid = await createTestUser(academy.id, { name: 'Kid' });
    const res = await api('POST', '/api/families', { name: 'F', memberIds: [kid.id] });
    expect(res.statusCode).toBe(201);
    expect(res.json().members[0].monthlyFee).toBeNull();
    expect(res.json().familyFee).toBe('0.00');
  });

  it('validates the payload', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    expect((await api('POST', '/api/families', { name: 'F', memberIds: [] })).statusCode).toBe(400);
    expect((await api('POST', '/api/families', { memberIds: [bia.id] })).statusCode).toBe(400);
    // Contact must be a member
    expect((await api('POST', '/api/families', { name: 'F', memberIds: [bia.id], contactStudentId: leo.id })).statusCode).toBe(400);
    expect((await api('POST', '/api/families', { name: 'F', memberIds: [bia.id], agreedPrice: 'abc' })).statusCode).toBe(400);
  });

  it('updates name, contact and agreed price', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id, leo.id] })).json();

    const res = await api('PUT', `/api/families/${fam.id}`, { name: 'Família Silva', contactStudentId: bia.id, agreedPrice: '60.00' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Família Silva', contactStudentId: bia.id, agreedPrice: '60.00', familyFee: '60.00' });

    const cleared = await api('PUT', `/api/families/${fam.id}`, { contactStudentId: null, agreedPrice: null });
    expect(cleared.json()).toMatchObject({ name: 'Família Silva', contactStudentId: null, agreedPrice: null, familyFee: '70.00' });

    const outsider = await student('Out', plan35.id);
    expect((await api('PUT', `/api/families/${fam.id}`, { contactStudentId: outsider.id })).statusCode).toBe(400);
  });

  it('adds and removes members; removing the contact clears it', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id], contactStudentId: bia.id })).json();

    const added = await api('POST', `/api/families/${fam.id}/members`, { studentId: leo.id });
    expect(added.statusCode).toBe(200);
    expect(added.json().members).toHaveLength(2);
    expect(added.json().priceReviewNeeded).toBe(false);

    const removed = await api('DELETE', `/api/families/${fam.id}/members/${bia.id}`);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().members.map((m: any) => m.id)).toEqual([leo.id]);
    expect(removed.json().contactStudentId).toBeNull();

    // Not a member any more
    expect((await api('DELETE', `/api/families/${fam.id}/members/${bia.id}`)).statusCode).toBe(404);
  });

  it('soft deletes a family: members freed, payments untouched', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id] })).json();
    await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-08'], amount: '35.00' });

    const res = await api('DELETE', `/api/families/${fam.id}`);
    expect(res.statusCode).toBe(204);

    expect((await api('GET', '/api/families')).json()).toHaveLength(0);
    expect((await api('GET', `/api/families/${fam.id}`)).statusCode).toBe(404);
    const [row] = await testDb.select().from(schema.user).where(eq(schema.user.id, bia.id));
    expect(row.familyId).toBeNull();
    const [famRow] = await testDb.select().from(schema.family).where(eq(schema.family.id, fam.id));
    expect(famRow.deletedAt).not.toBeNull();
    expect(await paymentsOf(bia.id)).toHaveLength(1);
  });

  it('is scoped to the academy (404 for another academy ids)', async () => {
    const a = await setup();
    const b = await setup();
    const bStudent = await b.student('B', b.plan35.id);
    const bFam = (await b.api('POST', '/api/families', { name: 'B', memberIds: [bStudent.id] })).json();
    const aStudent = await a.student('A', a.plan35.id);

    expect((await a.api('GET', `/api/families/${bFam.id}`)).statusCode).toBe(404);
    expect((await a.api('PUT', `/api/families/${bFam.id}`, { name: 'x' })).statusCode).toBe(404);
    expect((await a.api('DELETE', `/api/families/${bFam.id}`)).statusCode).toBe(404);
    expect((await a.api('GET', `/api/families/${bFam.id}/billing`)).statusCode).toBe(404);
    expect((await a.api('POST', `/api/families/${bFam.id}/payments`, { months: ['2026-08'], amount: '1.00' })).statusCode).toBe(404);
    expect((await a.api('POST', `/api/families/${bFam.id}/members`, { studentId: aStudent.id })).statusCode).toBe(404);
    // Another academy's student cannot be added
    expect((await a.api('POST', '/api/families', { name: 'A', memberIds: [bStudent.id] })).statusCode).toBe(404);
    expect((await a.api('GET', '/api/families')).json()).toHaveLength(0);
  });

  it('requires an owner', async () => {
    const { academy } = await setup();
    const student = await createTestUser(academy.id);
    expect((await app.inject({ method: 'GET', url: '/api/families' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/families', headers: authHeaders(student) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/families/suggestions', headers: authHeaders(student) })).statusCode).toBe(403);
  });
});

describe('family billing and payments', () => {
  it('billing lists owed months with fee, statuses and suggestions', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id, { startDate: '2026-09-01' });
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id, leo.id] })).json();

    const res = await api('GET', `/api/families/${fam.id}/billing`);
    expect(res.statusCode).toBe(200);
    const billing = res.json();
    expect(billing.suggestedMonths).toEqual(['2026-08', '2026-09']);
    expect(billing.suggestedAmount).toBe('105.00');
    const aug = billing.owedMonths[0];
    expect(aug.month).toBe('2026-08');
    expect(aug.fee).toBe('35.00');
    expect(aug.members).toContainEqual({ studentId: leo.id, status: 'not-billed' });
    expect(aug.members).toContainEqual({ studentId: bia.id, status: 'owed' });
  });

  it('rejects a payment for a month with no billable member', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id] })).json();
    // Before membership start
    expect((await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-07'], amount: '35.00' })).statusCode).toBe(400);
    expect((await api('POST', `/api/families/${fam.id}/payments`, { months: [], amount: '35.00' })).statusCode).toBe(400);
    expect((await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-13'], amount: '35.00' })).statusCode).toBe(400);
    expect((await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-08'], amount: 'x' })).statusCode).toBe(400);
    expect(await paymentsOf(bia.id)).toHaveLength(0);
  });

  it('defaults paymentDate to today and accepts an explicit one', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id] })).json();
    const r1 = await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-08'], amount: '35.00' });
    expect(r1.json().familyPayment.paymentDate).toBe('2026-09-26');
    const r2 = await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-09'], amount: '35.00', paymentDate: '2026-09-20' });
    expect(r2.json().payments[0].paymentDate).toBe('2026-09-20');
  });
});

describe('spec scenarios', () => {
  it('1. Silva family: one overdue card, a Family Payment settles both kids for both months', async () => {
    const { academy, owner, plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id, { phone: '911111111' });
    const leo = await student('Leo', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'Família Silva', memberIds: [bia.id, leo.id] })).json();

    const overdue = (await api('GET', `/api/payments/overdue?academyId=${academy.id}`)).json();
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({
      kind: 'family',
      familyId: fam.id,
      familyName: 'Família Silva',
      phone: '911111111',
      missedMonths: ['2026-08', '2026-09'],
      amountDue: '140.00',
      daysOverdue: 47,
    });
    expect(overdue[0].members).toHaveLength(2);
    expect(overdue[0].members).toContainEqual({ studentId: bia.id, name: 'Bia' });

    const res = await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-08', '2026-09'], amount: '140.00' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.familyPayment).toMatchObject({ familyId: fam.id, totalAmount: '140.00', months: ['2026-08', '2026-09'], recordedBy: owner.id });
    expect(body.payments).toHaveLength(4);
    for (const p of body.payments) {
      expect(p.amount).toBe('35.00');
      expect(p.familyPaymentId).toBe(body.familyPayment.id);
    }

    expect((await api('GET', `/api/payments/overdue?academyId=${academy.id}`)).json()).toHaveLength(0);
    for (const kid of [bia, leo]) {
      const status = await app.inject({ method: 'GET', url: '/api/payments/my-status', headers: authHeaders(kid) });
      expect(status.json().status).toBe('ok');
    }
  });

  it('2. Family Agreed Price 100 for 45/35/35 splits 39.13 / 30.43 / 30.44', async () => {
    const { plan35, plan45, student, api } = await setup();
    const carlos = await student('Carlos', plan45.id);
    const k1 = await student('K1', plan35.id);
    const k2 = await student('K2', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [carlos.id, k1.id, k2.id], agreedPrice: '100.00' })).json();
    expect(fam.familyFee).toBe('100.00');

    const res = await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-09'], amount: '100.00' });
    expect(res.statusCode).toBe(201);
    const payments = res.json().payments;
    expect(payments.find((p: any) => p.studentId === carlos.id).amount).toBe('39.13');
    const kids = payments.filter((p: any) => p.studentId !== carlos.id).map((p: any) => p.amount).sort();
    expect(kids).toEqual(['30.43', '30.44']);
  });

  it('3. Waived Month: waived member drops out of the Family Fee and is not overdue', async () => {
    const { academy, plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    const solo = await student('Solo', plan35.id, { startDate: '2026-09-01' });
    const fam = (await api('POST', '/api/families', { name: 'Família Silva', memberIds: [bia.id, leo.id] })).json();

    expect((await api('POST', `/api/students/${leo.id}/waived-months`, { month: '2026-09' })).statusCode).toBe(201);
    expect((await api('POST', `/api/students/${solo.id}/waived-months`, { month: '2026-09' })).statusCode).toBe(201);

    expect((await api('GET', `/api/families/${fam.id}`)).json().familyFee).toBe('35.00');
    const billing = (await api('GET', `/api/families/${fam.id}/billing`)).json();
    const sep = billing.owedMonths.find((m: any) => m.month === '2026-09');
    expect(sep.fee).toBe('35.00');
    expect(sep.members).toContainEqual({ studentId: leo.id, status: 'waived' });

    const overdue = (await api('GET', `/api/payments/overdue?academyId=${academy.id}`)).json();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].amountDue).toBe('105.00'); // Aug 70 + Sep 35

    // Paying Sep only charges Bia
    const pay = (await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-09'], amount: '35.00' })).json();
    expect(pay.payments).toHaveLength(1);
    expect(pay.payments[0].studentId).toBe(bia.id);
  });

  it('4. Individual payment inside a Family: month shows partly paid, others still owed', async () => {
    const { academy, owner, plan35, plan45, student, api } = await setup();
    const carlos = await student('Carlos', plan45.id, { startDate: '2026-09-01' });
    const k1 = await student('K1', plan35.id, { startDate: '2026-09-01' });
    const k2 = await student('K2', plan35.id, { startDate: '2026-09-01' });
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [carlos.id, k1.id, k2.id] })).json();

    await app.inject({
      method: 'POST', url: '/api/payments', headers: authHeaders(owner),
      payload: { studentId: carlos.id, amount: '45.00', paymentDate: '2026-09-20', referenceMonth: '2026-09' },
    });

    const billing = (await api('GET', `/api/families/${fam.id}/billing`)).json();
    expect(billing.owedMonths).toHaveLength(1);
    const statuses = billing.owedMonths[0].members;
    expect(statuses).toContainEqual({ studentId: carlos.id, status: 'paid' });
    expect(statuses).toContainEqual({ studentId: k1.id, status: 'owed' });
    expect(statuses).toContainEqual({ studentId: k2.id, status: 'owed' });

    const overdue = (await api('GET', `/api/payments/overdue?academyId=${academy.id}`)).json();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].kind).toBe('family');

    // A Family Payment for Sep does not charge Carlos twice
    const pay = (await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-09'], amount: '70.00' })).json();
    expect(pay.payments.map((p: any) => p.studentId).sort()).toEqual([k1.id, k2.id].sort());
    expect(await paymentsOf(carlos.id)).toHaveLength(1);
  });

  it('5. Member leaves: review warning, history kept, appears as own card', async () => {
    const { academy, plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    const fam = (await api('POST', '/api/families', { name: 'F', memberIds: [bia.id, leo.id], agreedPrice: '60.00' })).json();
    await api('POST', `/api/families/${fam.id}/payments`, { months: ['2026-08'], amount: '60.00' });

    const res = await api('DELETE', `/api/families/${fam.id}/members/${leo.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().priceReviewNeeded).toBe(true);
    expect(res.json().agreedPrice).toBe('60.00'); // never recalculated silently

    const leoPayments = await paymentsOf(leo.id);
    expect(leoPayments).toHaveLength(1);
    expect(leoPayments[0].amount).toBe('30.00');

    const overdue = (await api('GET', `/api/payments/overdue?academyId=${academy.id}`)).json();
    const leoCard = overdue.find((o: any) => o.kind === 'student');
    expect(leoCard).toMatchObject({ studentId: leo.id, studentName: 'Leo', missedMonths: ['2026-09'], amountDue: '35.00' });
    expect(overdue.find((o: any) => o.kind === 'family').familyId).toBe(fam.id);

    // Saving the agreed price (even unchanged) clears the warning
    const saved = await api('PUT', `/api/families/${fam.id}`, { agreedPrice: '60.00' });
    expect(saved.json().priceReviewNeeded).toBe(false);

    // Adding a member also flags review
    const added = await api('POST', `/api/families/${fam.id}/members`, { studentId: leo.id });
    expect(added.json().priceReviewNeeded).toBe(true);
  });

  it('6. Possible families: shared phone suggested, create or dismiss', async () => {
    const { plan35, student, api } = await setup();
    const a = await student('Stefan A', plan35.id, { phone: '934 232 146' });
    const b = await student('Stefan B', plan35.id, { phone: '934232146' });
    await student('Other C', plan35.id, { phone: '+351 900 000 001' });
    await student('Other D', plan35.id, { phone: '351900000001' });
    await student('Alone', plan35.id, { phone: '911' });

    const res = await api('GET', '/api/families/suggestions');
    expect(res.statusCode).toBe(200);
    const suggestions = res.json();
    expect(suggestions).toHaveLength(2);
    const stefan = suggestions.find((s: any) => s.phone === '934232146');
    expect(stefan.students.map((s: any) => s.id).sort()).toEqual([a.id, b.id].sort());
    expect(stefan.students[0]).toHaveProperty('name');

    // Nothing is created automatically
    expect((await api('GET', '/api/families')).json()).toHaveLength(0);

    // Creating the family removes the suggestion
    await api('POST', '/api/families', { name: 'Família Stefan', memberIds: [a.id, b.id] });
    // Dismissing persists
    expect((await api('POST', '/api/families/suggestions/dismiss', { phone: '351900000001' })).statusCode).toBe(204);
    expect((await api('POST', '/api/families/suggestions/dismiss', { phone: '351900000001' })).statusCode).toBe(204);
    expect((await api('GET', '/api/families/suggestions')).json()).toHaveLength(0);
  });

  it('7. Second family blocked', async () => {
    const { plan35, student, api } = await setup();
    const bia = await student('Bia', plan35.id);
    const leo = await student('Leo', plan35.id);
    const x = await student('X', plan35.id);
    await api('POST', '/api/families', { name: 'Silva', memberIds: [bia.id, leo.id] });

    const res = await api('POST', '/api/families', { name: 'Other', memberIds: [x.id, leo.id] });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'STUDENT_IN_FAMILY', studentIds: [leo.id] });
    const [xRow] = await testDb.select().from(schema.user).where(eq(schema.user.id, x.id));
    expect(xRow.familyId).toBeNull();

    const other = (await api('POST', '/api/families', { name: 'Other', memberIds: [x.id] })).json();
    const add = await api('POST', `/api/families/${other.id}/members`, { studentId: leo.id });
    expect(add.statusCode).toBe(409);
    expect(add.json()).toEqual({ error: 'STUDENT_IN_FAMILY', studentIds: [leo.id] });
  });
});
