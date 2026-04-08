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

// Academy lat/lng near São Paulo city centre
const ACADEMY_LAT = '-23.5505';
const ACADEMY_LNG = '-46.6333';
// Student coords within 250m of the academy
const NEAR_LAT = -23.551;
const NEAR_LNG = -46.634;

async function createClassAndStudent() {
  const acad = await createTestAcademy({ latitude: ACADEMY_LAT, longitude: ACADEMY_LNG });
  const instructor = await createTestInstructor(acad.id);
  const student = await createTestUser(acad.id, { role: 'student' });

  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = Math.min(now.getHours(), 22);
  const startTime = `${String(hour).padStart(2, '0')}:00`;
  const endTime = `${String(hour + 1).padStart(2, '0')}:30`;

  const [cls] = await testDb
    .insert(bjjClass)
    .values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Gi Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek,
      startTime,
      endTime,
    })
    .returning();
  return { acad, instructor, student, cls };
}

describe('POST /api/checkins', () => {
  it('creates a checkin and returns 201', async () => {
    const { student, cls } = await createClassAndStudent();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'button',
        latitude: NEAR_LAT,
        longitude: NEAR_LNG,
      },
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
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'button',
        latitude: NEAR_LAT,
        longitude: NEAR_LNG,
      },
    });

    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
    expect(streaks[0].longestStreak).toBe(1);
  });

  it('does not change streak on same-week checkin', async () => {
    const { student, cls } = await createClassAndStudent();

    // First checkin — insert directly to bypass duplicate check
    await testDb.insert(checkin).values({
      classId: cls.id,
      studentId: student.id,
      source: 'button',
    });
    await testDb.insert(streak).values({
      studentId: student.id,
      currentStreak: 1,
      longestStreak: 1,
      lastCheckinWeek: '2099-W01', // future week to simulate same-week
    });

    // Second checkin attempt should be blocked as CHECKIN_DUPLICATE
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'button',
        latitude: NEAR_LAT,
        longitude: NEAR_LNG,
      },
    });

    // duplicate block is expected — streak remains unchanged at 1
    expect(res.statusCode).toBe(400);
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
