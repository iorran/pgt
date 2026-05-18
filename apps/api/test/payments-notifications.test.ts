import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import { membershipPlan, studentMembership, payment } from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function setupOverdueStudent() {
  const acad = await createTestAcademy();
  const instructor = await createTestOwner(acad.id);
  const student = await createTestUser(acad.id, { role: 'student', phone: '5511999999999' });
  const [plan] = await testDb.insert(membershipPlan).values({
    academyId: acad.id, name: 'Monthly', price: '150.00', frequency: 'monthly',
  }).returning();
  const currentDay = new Date().getDate();
  await testDb.insert(studentMembership).values({
    studentId: student.id, planId: plan.id, startDate: currentMonthStart(),
    dueDay: Math.max(1, currentDay - 3),
  });
  return { acad, instructor, student, plan };
}

describe('GET /api/payments/my-status', () => {
  it('returns overdue when student has active membership, dueDay < today, no payment this month', async () => {
    const { student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const currentDay = new Date().getDate();
    const dueDay = Math.max(1, currentDay - 3);
    if (currentDay > dueDay) {
      expect(body.status).toBe('overdue');
      expect(body.daysOverdue).toBe(currentDay - dueDay);
    } else {
      // If currentDay <= dueDay (unlikely with Math.max(1, currentDay-3) but guard it)
      expect(['ok', 'upcoming']).toContain(body.status);
    }
  });

  it('returns ok when payment is recorded for current month', async () => {
    const { acad, instructor, student } = await setupOverdueStudent();

    const now = new Date();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await testDb.insert(payment).values({
      studentId: student.id,
      academyId: acad.id,
      amount: '150.00',
      paymentDate: `${referenceMonth}-01`,
      referenceMonth,
      recordedBy: instructor.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('returns upcoming when dueDay is within 3 days ahead', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });
    const [plan] = await testDb.insert(membershipPlan).values({
      academyId: acad.id, name: 'Monthly', price: '150.00', frequency: 'monthly',
    }).returning();

    const currentDay = new Date().getDate();
    // dueDay is 2 days ahead — upcoming
    const upcomingDueDay = currentDay + 2;

    // Only run this sub-test when upcomingDueDay is a valid day of the month
    if (upcomingDueDay <= 28) {
      await testDb.insert(studentMembership).values({
        studentId: student.id, planId: plan.id, startDate: currentMonthStart(),
        dueDay: upcomingDueDay,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/my-status',
        headers: authHeaders(student),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('upcoming');
      expect(body.daysUntilDue).toBe(2);
    }
  });

  it('returns ok when student has no active membership', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/my-status',
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('GET /api/payments/overdue (extended fields)', () => {
  it('response includes phone and notificationsMuted fields', async () => {
    const { acad } = await setupOverdueStudent();

    const now = new Date();
    const currentDay = now.getDate();

    const res = await app.inject({
      method: 'GET',
      url: `/api/payments/overdue?academyId=${acad.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Only verify fields if there is an overdue student (currentDay > dueDay)
    const dueDay = Math.max(1, currentDay - 3);
    if (currentDay > dueDay) {
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty('phone');
      expect(body[0]).toHaveProperty('notificationsMuted');
      expect(body[0].phone).toBe('5511999999999');
      expect(body[0].notificationsMuted).toBe(false);
    }
  });
});

describe('PUT /api/students/:id/notifications', () => {
  it('toggles notificationsMuted to true and returns updated record', async () => {
    const { instructor, student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/notifications`,
      headers: authHeaders(instructor),
      payload: { muted: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notificationsMuted).toBe(true);
    expect(body.studentId).toBe(student.id);
  });

  it('returns 403 for students', async () => {
    const { student } = await setupOverdueStudent();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/notifications`,
      headers: authHeaders(student),
      payload: { muted: true },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 when student has no active membership', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/notifications`,
      headers: authHeaders(instructor),
      payload: { muted: true },
    });

    expect(res.statusCode).toBe(404);
  });
});
