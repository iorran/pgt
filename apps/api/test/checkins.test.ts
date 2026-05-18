import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
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
import { bjjClass, checkin, streak } from '../src/db/schema/index';
import * as schema from '../src/db/schema/index';
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

// Academy timezone used by the tests — matches the DB default so behavior
// is deterministic regardless of the server's wall clock.
const ACADEMY_TZ = 'Europe/Lisbon';

function nowInTz(tz: string): { dayOfWeek: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const hourRaw = Number(parts.hour);
  return {
    dayOfWeek: map[parts.weekday] ?? 0,
    hour: hourRaw === 24 ? 0 : hourRaw,
    minute: Number(parts.minute),
  };
}

async function createClassAndStudent() {
  const acad = await createTestAcademy({
    latitude: ACADEMY_LAT,
    longitude: ACADEMY_LNG,
    timezone: ACADEMY_TZ,
  });
  const instructor = await createTestOwner(acad.id);
  const student = await createTestUser(acad.id, { role: 'student' });

  const { dayOfWeek, hour: tzHour } = nowInTz(ACADEMY_TZ);
  const hour = Math.min(tzHour, 22);
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

  it('rejects same-day duplicate check-ins when academy TZ day differs from UTC day', async () => {
    const academy = await createTestAcademy({
      timezone: 'Europe/Lisbon',
      latitude: '38.7',
      longitude: '-9.14',
    });
    const student = await createTestUser(academy.id, { role: 'student' });
    // Class that straddles UTC midnight in Lisbon DST (Lisbon = UTC+1 in April):
    //   Lisbon 00:55 → 01:30 == UTC 23:55 → 00:30 next day.
    // 2026-04-23 is a Thursday in Lisbon (dayOfWeek = 4).
    const cls = await createTestClass(academy.id, {
      startTime: '00:55',
      endTime: '01:30',
      dayOfWeek: 4,
    });

    // Check-in #1 at 23:58 UTC on Apr 22 == 00:58 Lisbon Apr 23
    await testDb.insert(schema.checkin).values({
      classId: cls.id,
      studentId: student.id,
      source: 'button',
      checkedInAt: new Date('2026-04-22T23:58:00Z'),
    });

    // Mock "now" at 00:03 UTC Apr 23 == 01:03 Lisbon Apr 23 (same Lisbon calendar day)
    // If the duplicate check used server TZ (UTC), it would see "today = Apr 23" and miss
    // the check-in at 23:58 UTC (which is Apr 22 in UTC). Our fix must correctly
    // detect it using Lisbon TZ.
    // Only mock Date/system time — leave setTimeout/setInterval etc. real so the
    // postgres driver's internal timers keep working.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-23T00:03:00Z'));
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkins',
        headers: authHeaders(student),
        payload: {
          classId: cls.id,
          source: 'button',
          latitude: 38.7,
          longitude: -9.14,
        },
      });
      // If the fix works, the handler sees the existing Apr 22 23:58 UTC check-in as "same
      // Lisbon day" and rejects as duplicate. Expected: 409.
      expect(res.statusCode).toBe(409);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateStreak uses academy TZ for ISO week boundary', async () => {
    // 2026-04-26T23:30:00Z is Sunday 23:30 UTC -> Monday 00:30 Lisbon (DST, UTC+1).
    // ISO week in UTC = 2026-W17 (week of Mon 2026-04-20).
    // ISO week in Lisbon = 2026-W18 (week of Mon 2026-04-27).
    const academy = await createTestAcademy({
      timezone: 'Europe/Lisbon',
      latitude: '38.7',
      longitude: '-9.14',
    });
    const student = await createTestUser(academy.id, { role: 'student' });
    // Class running 00:00 -> 02:00 Lisbon on Mondays (dayOfWeek = 1).
    const cls = await createTestClass(academy.id, {
      startTime: '00:00',
      endTime: '02:00',
      dayOfWeek: 1,
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-26T23:30:00Z'));
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/checkins',
        headers: authHeaders(student),
        payload: {
          classId: cls.id,
          source: 'button',
          latitude: 38.7,
          longitude: -9.14,
        },
      });
      expect(res.statusCode).toBe(201);
      const [row] = await testDb
        .select()
        .from(streak)
        .where(eq(streak.studentId, student.id));
      // Lisbon-TZ ISO week (W18), NOT UTC ISO week (W17).
      expect(row.lastCheckinWeek).toBe('2026-W18');
    } finally {
      vi.useRealTimers();
    }
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
    expect(res.statusCode).toBe(409);
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
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].class.id).toBe(cls.id);
  });

  it('returns empty array for student with no checkins', async () => {
    const { student } = await createClassAndStudent();

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/checkins/student/:studentId (enriched + TZ-aware)', () => {
  it('returns rows with class.name, class.type, and date in academy TZ', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const student = await createTestUser(academy.id, { role: 'student' });
    const cls = await createTestClass(academy.id, { name: 'No-Gi Mon 19:00', type: 'no-gi' });
    // 2026-04-22T23:30:00Z -> 2026-04-23 in Lisbon (DST, UTC+1)
    await testDb.insert(schema.checkin).values({
      classId: cls.id,
      studentId: student.id,
      source: 'button',
      checkedInAt: new Date('2026-04-22T23:30:00Z'),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
      headers: authHeaders(student),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].date).toBe('2026-04-23');
    expect(body[0].class).toEqual({ id: cls.id, name: 'No-Gi Mon 19:00', type: 'no-gi' });
    expect(body[0].checkedInAt).toBeDefined();
    expect(body[0].id).toBeDefined();
  });

  it('orders rows by checkedInAt desc', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const student = await createTestUser(academy.id, { role: 'student' });
    const cls = await createTestClass(academy.id);
    await testDb.insert(schema.checkin).values([
      { classId: cls.id, studentId: student.id, source: 'button', checkedInAt: new Date('2026-04-20T18:00:00Z') },
      { classId: cls.id, studentId: student.id, source: 'button', checkedInAt: new Date('2026-04-22T18:00:00Z') },
    ]);
    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
      headers: authHeaders(student),
    });
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(new Date(body[0].checkedInAt).getTime()).toBeGreaterThan(new Date(body[1].checkedInAt).getTime());
  });

  it('returns 403 when a student tries to read another student history', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const studentA = await createTestUser(academy.id, { role: 'student' });
    const studentB = await createTestUser(academy.id, { role: 'student' });
    const cls = await createTestClass(academy.id);
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: studentB.id, source: 'button',
      checkedInAt: new Date('2026-04-22T18:00:00Z'),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${studentB.id}`,
      headers: authHeaders(studentA),
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows a same-academy instructor to read a student history', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id, { role: 'student' });
    const cls = await createTestClass(academy.id);
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: student.id, source: 'button',
      checkedInAt: new Date('2026-04-22T18:00:00Z'),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
      headers: authHeaders(instructor),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('allows a same-academy owner to read a student history', async () => {
    const academy = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const student = await createTestUser(academy.id, { role: 'student' });
    const cls = await createTestClass(academy.id);
    await testDb.insert(schema.checkin).values({
      classId: cls.id, studentId: student.id, source: 'button',
      checkedInAt: new Date('2026-04-22T18:00:00Z'),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${student.id}`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('returns 403 for a cross-academy instructor', async () => {
    const academyA = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const academyB = await createTestAcademy({ timezone: 'Europe/Lisbon' });
    const instructorB = await createTestOwner(academyB.id);
    const studentA = await createTestUser(academyA.id, { role: 'student' });
    const res = await app.inject({
      method: 'GET',
      url: `/api/checkins/student/${studentA.id}`,
      headers: authHeaders(instructorB),
    });
    expect(res.statusCode).toBe(403);
  });
});
