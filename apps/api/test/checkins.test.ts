import { describe, it, expect } from 'vitest';
import { createTestApp, createTestAcademy, createTestUser } from './helpers';
import { db } from '../src/db/client';
import { bjjClass, checkin } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('POST /api/checkins', () => {
  it('creates a checkin for a class', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });
    const student = await createTestUser(academy.id, { role: 'student' });

    const [cls] = await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.classId).toBe(cls.id);
  });
});

describe('GET /api/checkins/class/:classId', () => {
  it('returns attendance for a class', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });
    const student = await createTestUser(academy.id, { role: 'student' });

    const [cls] = await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    }).returning();

    await db.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});
