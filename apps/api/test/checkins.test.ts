import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { bjjClass, checkin, streak } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

async function createClassAndStudent() {
  const acad = await createTestAcademy();
  const instructor = await createTestInstructor(acad.id);
  const student = await createTestUser(acad.id, { role: 'student' });
  const [cls] = await testDb.insert(bjjClass).values({
    academyId: acad.id,
    instructorId: instructor.id,
    name: 'Gi Class',
    type: 'gi',
    recurrence: 'weekly',
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:30',
  }).returning();
  return { acad, instructor, student, cls };
}

describe('POST /api/checkins', () => {
  it('creates a checkin and returns 201', async () => {
    const { student, cls } = await createClassAndStudent();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.classId).toBe(cls.id);
    expect(body.checkedInAt).toBeDefined();
  });

  it('creates a streak record on first checkin', async () => {
    const { student, cls } = await createClassAndStudent();

    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
    expect(streaks[0].longestStreak).toBe(1);
  });

  it('does not change streak on same-week checkin', async () => {
    const { student, cls } = await createClassAndStudent();

    // First checkin
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    // Second checkin same week
    await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: cls.id, studentId: student.id },
    });

    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
  });
});

describe('GET /api/checkins/class/:classId', () => {
  it('returns checkins for a class', async () => {
    const { student, cls } = await createClassAndStudent();

    await testDb.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].classId).toBe(cls.id);
  });

  it('returns empty array when no checkins exist', async () => {
    const { cls } = await createClassAndStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/class/${cls.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/checkins/student/:studentId', () => {
  it('returns checkin history for a student', async () => {
    const { student, cls } = await createClassAndStudent();

    await testDb.insert(checkin).values({ classId: cls.id, studentId: student.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentId).toBe(student.id);
  });

  it('returns empty array for student with no checkins', async () => {
    const { student } = await createClassAndStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});
