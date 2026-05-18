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
import * as schema from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/gamification/profile/:studentId', () => {
  it('returns empty profile for a student with no activity (self read)', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Number(body.xp)).toBe(0);
    expect(body.streak).toEqual({ currentStreak: 0, longestStreak: 0 });
    expect(body.badges).toHaveLength(0);
  });

  it('returns XP, streak, and badges when data exists (same-academy instructor)', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);

    // Insert XP entries
    await testDb.insert(schema.xpEntry).values([
      {
        studentId: student.id,
        xpAmount: 50,
        sourceType: 'checkin',
      },
      {
        studentId: student.id,
        xpAmount: 100,
        sourceType: 'competition',
      },
    ]);

    // Insert streak
    await testDb.insert(schema.streak).values({
      studentId: student.id,
      currentStreak: 3,
      longestStreak: 7,
    });

    // Insert badge definition and award
    const [badge] = await testDb
      .insert(schema.badgeDefinition)
      .values({
        academyId: academy.id,
        name: 'Iron Will',
        description: 'Train 30 days in a row',
        icon: 'fire',
        criteriaType: 'streak',
        criteriaValue: 30,
      })
      .returning();

    await testDb.insert(schema.studentBadge).values({
      studentId: student.id,
      badgeDefinitionId: badge.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Number(body.xp)).toBe(150);
    expect(body.streak.currentStreak).toBe(3);
    expect(body.streak.longestStreak).toBe(7);
    expect(body.badges).toHaveLength(1);
    expect(body.badges[0].name).toBe('Iron Will');
    expect(body.badges[0].description).toBe('Train 30 days in a row');
    expect(body.badges[0].icon).toBe('fire');
    expect(body.badges[0].earnedAt).toBeDefined();
  });

  it('allows same-academy owner to read a student profile', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${student.id}`,
      headers: authHeaders(owner),
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when unauthenticated', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${student.id}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a cross-academy instructor', async () => {
    const academyA = await createTestAcademy();
    const academyB = await createTestAcademy();
    const instructorB = await createTestOwner(academyB.id);
    const studentA = await createTestUser(academyA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${studentA.id}`,
      headers: authHeaders(instructorB),
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for a student reading another student', async () => {
    const academy = await createTestAcademy();
    const a = await createTestUser(academy.id);
    const b = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${b.id}`,
      headers: authHeaders(a),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/gamification/badges', () => {
  it('lists badge definitions for an academy', async () => {
    const academy = await createTestAcademy();
    await testDb.insert(schema.badgeDefinition).values([
      {
        academyId: academy.id,
        name: 'First Class',
        description: 'Attend your first class',
        icon: 'star',
        criteriaType: 'checkin_count',
        criteriaValue: 1,
      },
      {
        academyId: academy.id,
        name: 'Warrior',
        description: 'Attend 100 classes',
        icon: 'shield',
        criteriaType: 'checkin_count',
        criteriaValue: 100,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/badges?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.map((b: any) => b.name).sort()).toEqual(['First Class', 'Warrior']);
  });

  it('returns empty array when no badges exist', async () => {
    const academy = await createTestAcademy();

    const res = await app.inject({
      method: 'GET',
      url: `/api/gamification/badges?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('POST /api/gamification/badges', () => {
  it('instructor creates a badge definition', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/gamification/badges',
      headers: authHeaders(instructor),
      payload: {
        name: 'Competition King',
        description: 'Win 5 competitions',
        icon: 'crown',
        criteriaType: 'competition_wins',
        criteriaValue: 5,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Competition King');
    expect(body.description).toBe('Win 5 competitions');
    expect(body.icon).toBe('crown');
    expect(body.criteriaType).toBe('competition_wins');
    expect(body.criteriaValue).toBe(5);
    expect(body.academyId).toBe(academy.id);
  });
});

describe('POST /api/gamification/badges/:badgeId/award/:studentId', () => {
  it('manually awards a badge and creates XP entry', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id, { name: 'Top Student' });

    const [badge] = await testDb
      .insert(schema.badgeDefinition)
      .values({
        academyId: academy.id,
        name: 'MVP',
        description: 'Most Valuable Practitioner',
        icon: 'trophy',
        criteriaType: 'manual',
        criteriaValue: 50,
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/gamification/badges/${badge.id}/award/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.studentId).toBe(student.id);
    expect(body.badgeDefinitionId).toBe(badge.id);
    expect(body.earnedAt).toBeDefined();

    // Verify XP entry was created (criteriaValue * 10)
    const xpEntries = await testDb
      .select()
      .from(schema.xpEntry)
      .where(eq(schema.xpEntry.studentId, student.id));
    expect(xpEntries).toHaveLength(1);
    expect(xpEntries[0].xpAmount).toBe(500); // 50 * 10
    expect(xpEntries[0].sourceType).toBe('badge');
    expect(xpEntries[0].sourceId).toBe(body.id);
  });

  it('badge award is visible in gamification profile', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);

    const [badge] = await testDb
      .insert(schema.badgeDefinition)
      .values({
        academyId: academy.id,
        name: 'Consistency',
        description: '4-week streak',
        icon: 'flame',
        criteriaType: 'streak',
        criteriaValue: 4,
      })
      .returning();

    // Award the badge via API
    await app.inject({
      method: 'POST',
      url: `/api/gamification/badges/${badge.id}/award/${student.id}`,
      headers: authHeaders(instructor),
    });

    // Check profile
    const profileRes = await app.inject({
      method: 'GET',
      url: `/api/gamification/profile/${student.id}`,
      headers: authHeaders(instructor),
    });

    const profile = profileRes.json();
    expect(Number(profile.xp)).toBe(40); // 4 * 10
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0].name).toBe('Consistency');
  });
});
