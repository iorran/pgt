import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestOwner,
  authHeaders,
  testDb,
} from './helpers';
import { bjjClass } from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/classes', () => {
  it('returns empty array when no classes exist', async () => {
    const acad = await createTestAcademy();

    const res = await app.inject({
      method: 'GET',
      url: `/api/classes?academyId=${acad.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('returns classes for the academy', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);

    await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Fundamentals',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/classes?academyId=${acad.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Gi Fundamentals');
  });
});

describe('POST /api/classes', () => {
  it('instructor creates a class', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/classes',
      headers: authHeaders(instructor),
      payload: {
        name: 'No-Gi Advanced',
        type: 'no-gi',
        recurrence: 'weekly',
        dayOfWeek: 3,
        startTime: '19:00',
        endTime: '20:30',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('No-Gi Advanced');
    expect(body.type).toBe('no-gi');
    expect(body.academyId).toBe(acad.id);
    expect(body.instructorId).toBe(instructor.id);
  });

  it('student cannot create a class (403)', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/classes',
      headers: authHeaders(student),
      payload: {
        name: 'Unauthorized Class',
        type: 'gi',
        recurrence: 'weekly',
        dayOfWeek: 1,
        startTime: '07:00',
        endTime: '08:30',
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/classes/:id', () => {
  it('instructor updates a class', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);

    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Old Name',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/classes/${cls.id}`,
      headers: authHeaders(instructor),
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('New Name');
  });

  it('student cannot update a class (403)', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });

    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Some Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/classes/${cls.id}`,
      headers: authHeaders(student),
      payload: { name: 'Hacked Name' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/classes/:id', () => {
  it('soft-deletes a class by setting active to false', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);

    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'To Delete',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/classes/${cls.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);
  });

  it('student cannot delete a class (403)', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestOwner(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });

    const [cls] = await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Protected Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/classes/${cls.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(403);
  });
});
