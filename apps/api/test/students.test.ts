import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestInstructor, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

describe('GET /api/students', () => {
  it('lists students with membership info', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Ana Silva', belt: 'blue' });
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Standard', price: '120.00', frequency: 'monthly',
    }).returning();
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, planId: plan.id, startDate: '2025-01-01', dueDay: 10,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Ana Silva');
    expect(body[0].planName).toBe('Standard');
    expect(body[0].dueDay).toBe(10);
  });

  it('returns students without membership (planName null)', async () => {
    const academy = await createTestAcademy();
    await createTestUser(academy.id, { name: 'No Plan Student' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].planName).toBeNull();
  });

  it('does not list instructors', async () => {
    const academy = await createTestAcademy();
    await createTestUser(academy.id, { name: 'Student' });
    await createTestInstructor(academy.id, { name: 'Instructor' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students?academyId=${academy.id}`,
    });

    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Student');
  });
});

describe('GET /api/students/:id', () => {
  it('returns single student with membership info for same-academy instructor', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id, { name: 'Carlos' });
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Premium', price: '200.00', frequency: 'monthly',
    }).returning();
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, planId: plan.id, startDate: '2025-03-01', dueDay: 5,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Carlos');
    expect(body.planName).toBe('Premium');
    expect(body.planId).toBe(plan.id);
    expect(body.dueDay).toBe(5);
    expect(body.membershipStartDate).toBe('2025-03-01');
  });

  it('returns student without membership', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id, { name: 'New Student' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('New Student');
    expect(body.planName).toBeNull();
  });

  it('allows same-academy owner to read a student profile', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const student = await createTestUser(academy.id, { name: 'Owned Student' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(owner),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Owned Student');
  });

  it('allows the student themselves to read their own profile', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Self' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Self');
  });

  it('returns 401 when unauthenticated', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a student reading another student', async () => {
    const academy = await createTestAcademy();
    const a = await createTestUser(academy.id);
    const b = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${b.id}`,
      headers: authHeaders(a),
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for a cross-academy instructor', async () => {
    const academyA = await createTestAcademy();
    const academyB = await createTestAcademy();
    const instructorB = await createTestInstructor(academyB.id);
    const studentA = await createTestUser(academyA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${studentA.id}`,
      headers: authHeaders(instructorB),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/students/:id/membership', () => {
  it('instructor assigns membership to student', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id);
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Basic', price: '99.00', frequency: 'monthly',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/students/${student.id}/membership`,
      headers: authHeaders(instructor),
      payload: { planId: plan.id, startDate: '2025-06-01', dueDay: 15 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.planId).toBe(plan.id);
    expect(body.dueDay).toBe(15);
    expect(body.active).toBe(true);
  });

  it('student cannot assign membership', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Basic', price: '99.00', frequency: 'monthly',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/students/${student.id}/membership`,
      headers: authHeaders(student),
      payload: { planId: plan.id, startDate: '2025-06-01', dueDay: 15 },
    });

    expect(res.statusCode).toBe(403);
  });

  it('deactivates previous active membership when assigning a new one', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id);
    const [plan1] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Basic', price: '99.00', frequency: 'monthly',
    }).returning();
    const [plan2] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Premium', price: '199.00', frequency: 'monthly',
    }).returning();

    // Assign first plan
    await app.inject({
      method: 'POST',
      url: `/api/students/${student.id}/membership`,
      headers: authHeaders(instructor),
      payload: { planId: plan1.id, startDate: '2025-01-01', dueDay: 7 },
    });

    // Assign second plan
    await app.inject({
      method: 'POST',
      url: `/api/students/${student.id}/membership`,
      headers: authHeaders(instructor),
      payload: { planId: plan2.id, startDate: '2025-06-01', dueDay: 15 },
    });

    // Should only have one active membership
    const { eq, and } = await import('drizzle-orm');
    const activeMemberships = await testDb
      .select()
      .from(schema.studentMembership)
      .where(and(eq(schema.studentMembership.studentId, student.id), eq(schema.studentMembership.active, true)));

    expect(activeMemberships).toHaveLength(1);
    expect(activeMemberships[0].planId).toBe(plan2.id);
    expect(activeMemberships[0].dueDay).toBe(15);

    // Students list should return one row (not duplicated)
    const res = await app.inject({
      method: 'GET',
      url: `/api/students?academyId=${academy.id}`,
    });
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].planName).toBe('Premium');
  });
});

describe('PUT /api/students/:id/membership', () => {
  it('instructor updates active membership', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const student = await createTestUser(academy.id);
    const [plan1] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Basic', price: '99.00', frequency: 'monthly',
    }).returning();
    const [plan2] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Premium', price: '199.00', frequency: 'monthly',
    }).returning();
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, planId: plan1.id, startDate: '2025-01-01', dueDay: 10,
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/students/${student.id}/membership`,
      headers: authHeaders(instructor),
      payload: { planId: plan2.id, dueDay: 20 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.planId).toBe(plan2.id);
    expect(body.dueDay).toBe(20);
  });
});
