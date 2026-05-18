import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

describe('POST /api/payments', () => {
  it('instructor records a payment', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: authHeaders(instructor),
      payload: {
        studentId: student.id,
        amount: '150.00',
        paymentDate: '2025-06-10',
        referenceMonth: '2025-06',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.academyId).toBe(academy.id);
    expect(body.amount).toBe('150.00');
    expect(body.referenceMonth).toBe('2025-06');
    expect(body.recordedBy).toBe(instructor.id);
  });

  it('student cannot record a payment', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments',
      headers: authHeaders(student),
      payload: {
        studentId: student.id,
        amount: '100.00',
        paymentDate: '2025-06-10',
        referenceMonth: '2025-06',
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/payments', () => {
  it('lists all payments for an academy', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student1 = await createTestUser(academy.id, { name: 'Student 1' });
    const student2 = await createTestUser(academy.id, { name: 'Student 2' });

    await testDb.insert(schema.payment).values([
      { studentId: student1.id, academyId: academy.id, amount: '100.00', paymentDate: '2025-06-05', referenceMonth: '2025-06', recordedBy: instructor.id },
      { studentId: student2.id, academyId: academy.id, amount: '120.00', paymentDate: '2025-06-08', referenceMonth: '2025-06', recordedBy: instructor.id },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('returns empty when no payments exist', async () => {
    const academy = await createTestAcademy();
    const res = await app.inject({
      method: 'GET',
      url: `/api/payments?academyId=${academy.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/payments/student/:studentId', () => {
  it('returns payment history for a student', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);

    await testDb.insert(schema.payment).values([
      { studentId: student.id, academyId: academy.id, amount: '100.00', paymentDate: '2025-04-10', referenceMonth: '2025-04', recordedBy: instructor.id },
      { studentId: student.id, academyId: academy.id, amount: '100.00', paymentDate: '2025-05-10', referenceMonth: '2025-05', recordedBy: instructor.id },
      { studentId: student.id, academyId: academy.id, amount: '100.00', paymentDate: '2025-06-10', referenceMonth: '2025-06', recordedBy: instructor.id },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(3);
  });

  it('returns empty array for student with no payments', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/payments/overdue', () => {
  it('returns students who have not paid and are past due day', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);

    const paidStudent = await createTestUser(academy.id, { name: 'Paid Student' });
    const unpaidStudent = await createTestUser(academy.id, { name: 'Unpaid Student' });

    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Standard', price: '100.00', frequency: 'monthly',
    }).returning();

    // Both students start this month with dueDay=1 so current day > dueDay means overdue
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    await testDb.insert(schema.studentMembership).values([
      { studentId: paidStudent.id, planId: plan.id, startDate: currentMonthStart, dueDay: 1 },
      { studentId: unpaidStudent.id, planId: plan.id, startDate: currentMonthStart, dueDay: 1 },
    ]);

    // Record payment for paidStudent for current month
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await testDb.insert(schema.payment).values({
      studentId: paidStudent.id,
      academyId: academy.id,
      amount: '100.00',
      paymentDate: `${referenceMonth}-01`,
      referenceMonth,
      recordedBy: instructor.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/overdue?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    const currentDay = now.getDate();
    if (currentDay > 1) {
      expect(body).toHaveLength(1);
      expect(body[0].studentName).toBe('Unpaid Student');
      expect(body[0].daysOverdue).toBe(currentDay - 1);
      expect(body[0].referenceMonth).toBe(referenceMonth);
    } else {
      expect(body).toHaveLength(0);
    }
  });

  it('returns empty when all students have paid', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);

    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Plan', price: '100.00', frequency: 'monthly',
    }).returning();

    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, planId: plan.id, startDate: currentMonthStart, dueDay: 1,
    });

    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await testDb.insert(schema.payment).values({
      studentId: student.id,
      academyId: academy.id,
      amount: '100.00',
      paymentDate: `${referenceMonth}-01`,
      referenceMonth,
      recordedBy: instructor.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/overdue?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('detects overdue students with unpaid past months (multi-month backlog)', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Behind Student' });

    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Plan', price: '100.00', frequency: 'monthly',
    }).returning();

    // Membership started 2 months ago, never paid
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startDate = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, planId: plan.id, startDate, dueDay: 5,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/overdue?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentName).toBe('Behind Student');
    // At least 2 unpaid past months
    expect(body[0].missedMonths.length).toBeGreaterThanOrEqual(2);
    // Days overdue should be more than a month
    expect(body[0].daysOverdue).toBeGreaterThan(30);
  });
});
