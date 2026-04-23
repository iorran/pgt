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
import { bjjClass, checkin } from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

// Academy lat/lng — São Paulo city centre
const ACADEMY_LAT = '-23.5505';
const ACADEMY_LNG = '-46.6333';
// Coordinates within 250 m of the academy
const NEAR_LAT = -23.551;
const NEAR_LNG = -46.634;
// Coordinates ~5 km away
const FAR_LAT = -23.595;
const FAR_LNG = -46.687;

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

/** Creates an academy (with location), instructor, student, and a class
 *  whose dayOfWeek + startTime match "right now" so time-window passes. */
async function setupClassToday(opts: { withLocation?: boolean } = {}) {
  const withLocation = opts.withLocation !== false;

  const acad = await createTestAcademy(
    withLocation
      ? { latitude: ACADEMY_LAT, longitude: ACADEMY_LNG, timezone: ACADEMY_TZ }
      : { timezone: ACADEMY_TZ },
  );
  const instructor = await createTestInstructor(acad.id);
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
      name: 'Morning Gi',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek,
      startTime,
      endTime,
    })
    .returning();

  return { acad, instructor, student, cls };
}

describe('POST /api/checkins — authentication', () => {
  it('returns 401 without auth headers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      payload: { classId: 'some-id', source: 'button' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/checkins — CLASS_NOT_ACTIVE', () => {
  it('rejects checkin for an inactive class', async () => {
    const { student, cls } = await setupClassToday();

    // Mark class inactive
    await testDb.update(bjjClass).set({ active: false }).where(
      (t) => t.id === cls.id ? true : false,
    );
    // Re-fetch and confirm by inserting a new inactive class
    const acad2 = await createTestAcademy({ latitude: ACADEMY_LAT, longitude: ACADEMY_LNG });
    const inst2 = await createTestInstructor(acad2.id);
    const now = new Date();
    const [inactiveCls] = await testDb
      .insert(bjjClass)
      .values({
        academyId: acad2.id,
        instructorId: inst2.id,
        name: 'Inactive Class',
        type: 'gi',
        recurrence: 'weekly',
        dayOfWeek: now.getDay(),
        startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
        endTime: `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:30`,
        active: false,
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: inactiveCls.id,
        source: 'button',
        latitude: NEAR_LAT,
        longitude: NEAR_LNG,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CLASS_NOT_ACTIVE');
  });
});

describe('POST /api/checkins — OUTSIDE_TIME_WINDOW', () => {
  it('rejects checkin outside time window (class at 03:00-04:00)', async () => {
    const acad = await createTestAcademy({ latitude: ACADEMY_LAT, longitude: ACADEMY_LNG });
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { role: 'student' });

    // Class at 03:00 – almost certainly outside the window right now
    const [cls] = await testDb
      .insert(bjjClass)
      .values({
        academyId: acad.id,
        instructorId: instructor.id,
        name: 'Night Owl',
        type: 'gi',
        recurrence: 'weekly',
        dayOfWeek: new Date().getDay(),
        startTime: '03:00',
        endTime: '04:00',
      })
      .returning();

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

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('OUTSIDE_TIME_WINDOW');
  });
});

describe('POST /api/checkins — CHECKIN_DUPLICATE', () => {
  it('rejects duplicate checkin for same class same day', async () => {
    const { student, cls } = await setupClassToday();

    // Insert a prior checkin for today
    await testDb.insert(checkin).values({
      classId: cls.id,
      studentId: student.id,
      source: 'button',
    });

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

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('CHECKIN_DUPLICATE');
  });
});

describe('POST /api/checkins — TOO_FAR', () => {
  it('rejects checkin when student is too far from academy', async () => {
    const { student, cls } = await setupClassToday();

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'button',
        latitude: FAR_LAT,
        longitude: FAR_LNG,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('TOO_FAR');
  });
});

describe('POST /api/checkins — LOCATION_NOT_SET', () => {
  it('rejects checkin when academy has no location', async () => {
    const { student, cls } = await setupClassToday({ withLocation: false });

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

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('LOCATION_NOT_SET');
  });
});

describe('POST /api/checkins — different class same day', () => {
  it('allows checkin to a different class on the same day', async () => {
    const { acad, instructor, student, cls } = await setupClassToday();

    // Pre-existing checkin for a different class with a different startTime
    const now = new Date();
    const safeHour = Math.min(now.getHours(), 22);
    // Use a different hour than setupClassToday's class
    const altHour = safeHour >= 2 ? safeHour - 2 : safeHour + 2;
    const altStart = `${String(altHour).padStart(2, '0')}:00`;
    const altEnd = `${String(altHour + 1).padStart(2, '0')}:30`;

    const [otherCls] = await testDb
      .insert(bjjClass)
      .values({
        academyId: acad.id,
        instructorId: instructor.id,
        name: 'Evening No-Gi',
        type: 'no-gi',
        recurrence: 'weekly',
        dayOfWeek: now.getDay(),
        startTime: altStart,
        endTime: altEnd,
      })
      .returning();

    // Insert checkin for the other class
    await testDb.insert(checkin).values({
      classId: otherCls.id,
      studentId: student.id,
      source: 'button',
    });

    // Now checkin to today's main class — should succeed
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
  });
});

describe('POST /api/checkins — OVERLAPPING_CLASS', () => {
  it('rejects checkin to a class with the same start time as an existing checkin today', async () => {
    const { acad, instructor, student, cls } = await setupClassToday();

    // Another class at the exact same startTime
    const [overlapCls] = await testDb
      .insert(bjjClass)
      .values({
        academyId: acad.id,
        instructorId: instructor.id,
        name: 'Overlap Class',
        type: 'no-gi',
        recurrence: 'weekly',
        dayOfWeek: cls.dayOfWeek!,
        startTime: cls.startTime,
        endTime: cls.endTime,
      })
      .returning();

    // Student already checked into the original class
    await testDb.insert(checkin).values({
      classId: cls.id,
      studentId: student.id,
      source: 'button',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: overlapCls.id,
        source: 'button',
        latitude: NEAR_LAT,
        longitude: NEAR_LNG,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('OVERLAPPING_CLASS');
  });
});

describe('POST /api/checkins — success with source and coordinates', () => {
  it('stores source and coordinates on successful checkin', async () => {
    const { student, cls } = await setupClassToday();

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
    expect(body.source).toBe('button');
    expect(Number(body.latitude)).toBeCloseTo(NEAR_LAT, 3);
    expect(Number(body.longitude)).toBeCloseTo(NEAR_LNG, 3);
  });
});

describe('POST /api/checkins — streak update', () => {
  it('updates streak on successful checkin', async () => {
    const { student, cls } = await setupClassToday();

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

    const { streak } = await import('../src/db/schema/index');
    const { eq } = await import('drizzle-orm');
    const streaks = await testDb.select().from(streak).where(eq(streak.studentId, student.id));
    expect(streaks).toHaveLength(1);
    expect(streaks[0].currentStreak).toBe(1);
  });
});
