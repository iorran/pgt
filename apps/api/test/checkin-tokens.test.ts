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
import { bjjClass, checkinToken } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

const ACADEMY_LAT = '-23.5505';
const ACADEMY_LNG = '-46.6333';
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

async function setupActiveClass() {
  const acad = await createTestAcademy({
    latitude: ACADEMY_LAT,
    longitude: ACADEMY_LNG,
    timezone: ACADEMY_TZ,
  });
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

describe('GET /api/checkins/tokens — role enforcement', () => {
  it('returns 403 for a student', async () => {
    const { student } = await setupActiveClass();

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 without auth headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/checkins/tokens — active classes', () => {
  it('returns tokens for currently active classes', async () => {
    const { instructor } = await setupActiveClass();

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      classId: expect.any(String),
      className: 'Morning Gi',
      classType: 'gi',
      token: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it('returns empty array when no classes are currently active', async () => {
    const acad = await createTestAcademy({ latitude: ACADEMY_LAT, longitude: ACADEMY_LNG });
    const instructor = await createTestInstructor(acad.id);

    // Class at 03:00 — outside window right now
    await testDb.insert(bjjClass).values({
      academyId: acad.id,
      instructorId: instructor.id,
      name: 'Night Class',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: new Date().getDay(),
      startTime: '03:00',
      endTime: '04:00',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('reuses an existing valid token rather than creating a new one', async () => {
    const { instructor, cls } = await setupActiveClass();

    // Pre-insert a valid token for this class
    const existingToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 min in the future
    await testDb.insert(checkinToken).values({
      classId: cls.id,
      token: existingToken,
      expiresAt,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/checkins/tokens',
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].token).toBe(existingToken);
  });
});

describe('POST /api/checkins — QR token validation', () => {
  it('accepts a valid QR token and creates checkin (201)', async () => {
    const { student, cls } = await setupActiveClass();

    // Create a valid token
    const validToken = crypto.randomUUID();
    await testDb.insert(checkinToken).values({
      classId: cls.id,
      token: validToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'qr',
        token: validToken,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().source).toBe('qr');
  });

  it('rejects an expired QR token with INVALID_TOKEN', async () => {
    const { student, cls } = await setupActiveClass();

    const expiredToken = crypto.randomUUID();
    await testDb.insert(checkinToken).values({
      classId: cls.id,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id,
        source: 'qr',
        token: expiredToken,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_TOKEN');
  });

  it('rejects a token that belongs to a different class', async () => {
    const { acad, instructor, student, cls } = await setupActiveClass();

    const { dayOfWeek, hour: tzHour } = nowInTz(ACADEMY_TZ);
    const hour = Math.min(tzHour, 22);
    const [otherCls] = await testDb
      .insert(bjjClass)
      .values({
        academyId: acad.id,
        instructorId: instructor.id,
        name: 'Other Class',
        type: 'no-gi',
        recurrence: 'weekly',
        dayOfWeek,
        startTime: `${String(hour).padStart(2, '0')}:00`,
        endTime: `${String(hour + 1).padStart(2, '0')}:30`,
      })
      .returning();

    const wrongToken = crypto.randomUUID();
    await testDb.insert(checkinToken).values({
      classId: otherCls.id,
      token: wrongToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/checkins',
      headers: authHeaders(student),
      payload: {
        classId: cls.id, // claims cls, but token belongs to otherCls
        source: 'qr',
        token: wrongToken,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_TOKEN');
  });
});
