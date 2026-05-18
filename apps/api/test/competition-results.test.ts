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

describe('POST /api/competition-results', () => {
  it('submits a result with status=pending and pointsAwarded=0', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Competitor' });
    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 10, 2: 7, 3: 5 },
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/competition-results',
      headers: authHeaders(student),
      payload: {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Pan American',
        competitionDate: '2026-04-15',
        position: 1,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('pending');
    expect(body.pointsAwarded).toBe(0);
    expect(body.competitionName).toBe('Pan American');
    expect(body.position).toBe(1);
    expect(body.submittedBy).toBe(student.id);
  });
});

describe('GET /api/competition-results', () => {
  it('lists results filtered by seasonId and status', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 10 },
      })
      .returning();

    await testDb.insert(schema.competitionResult).values([
      {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Comp A',
        competitionDate: '2026-02-01',
        position: 1,
        status: 'pending',
        pointsAwarded: 0,
        submittedBy: student.id,
      },
      {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Comp B',
        competitionDate: '2026-03-01',
        position: 2,
        status: 'approved',
        pointsAwarded: 7,
        submittedBy: student.id,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/competition-results?seasonId=${seasonRecord.id}&status=pending`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].competitionName).toBe('Comp A');
    expect(body[0].status).toBe('pending');
  });

  it('lists all results for a season when no status filter', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 10 },
      })
      .returning();

    await testDb.insert(schema.competitionResult).values([
      {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Comp A',
        competitionDate: '2026-02-01',
        position: 1,
        status: 'pending',
        pointsAwarded: 0,
        submittedBy: student.id,
      },
      {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Comp B',
        competitionDate: '2026-03-01',
        position: 2,
        status: 'approved',
        pointsAwarded: 7,
        submittedBy: student.id,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/competition-results?seasonId=${seasonRecord.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
});

describe('PUT /api/competition-results/:id/approve', () => {
  it('approves a result, calculates points from season config, and creates XP entry', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Competitor' });
    const instructor = await createTestOwner(academy.id);

    const pointsConfig = { 1: 15, 2: 10, 3: 7 };
    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig,
      })
      .returning();

    // Submit a pending result (position 2 -> should get 10 points)
    const [pendingResult] = await testDb
      .insert(schema.competitionResult)
      .values({
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'World Championship',
        competitionDate: '2026-05-01',
        position: 2,
        status: 'pending',
        pointsAwarded: 0,
        submittedBy: student.id,
      })
      .returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/competition-results/${pendingResult.id}/approve`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('approved');
    expect(body.pointsAwarded).toBe(10);
    expect(body.reviewedBy).toBe(instructor.id);

    // Verify XP entry was created (points * 10)
    const xpEntries = await testDb
      .select()
      .from(schema.xpEntry)
      .where(eq(schema.xpEntry.studentId, student.id));
    expect(xpEntries).toHaveLength(1);
    expect(xpEntries[0].xpAmount).toBe(100); // 10 points * 10
    expect(xpEntries[0].sourceType).toBe('competition');
    expect(xpEntries[0].sourceId).toBe(pendingResult.id);
  });

  it('awards 0 points for a position not in the config', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const instructor = await createTestOwner(academy.id);

    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 10, 2: 7 },
      })
      .returning();

    const [pendingResult] = await testDb
      .insert(schema.competitionResult)
      .values({
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Local Comp',
        competitionDate: '2026-05-01',
        position: 5,
        status: 'pending',
        pointsAwarded: 0,
        submittedBy: student.id,
      })
      .returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/competition-results/${pendingResult.id}/approve`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('approved');
    expect(body.pointsAwarded).toBe(0);
  });
});

describe('PUT /api/competition-results/:id/reject', () => {
  it('rejects a result, sets status to rejected and no points', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const instructor = await createTestOwner(academy.id);

    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 10 },
      })
      .returning();

    const [pendingResult] = await testDb
      .insert(schema.competitionResult)
      .values({
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Fake Comp',
        competitionDate: '2026-05-01',
        position: 1,
        status: 'pending',
        pointsAwarded: 0,
        submittedBy: student.id,
      })
      .returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/competition-results/${pendingResult.id}/reject`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('rejected');
    expect(body.reviewedBy).toBe(instructor.id);
    expect(body.pointsAwarded).toBe(0);

    // Verify no XP entry was created
    const xpEntries = await testDb
      .select()
      .from(schema.xpEntry)
      .where(eq(schema.xpEntry.studentId, student.id));
    expect(xpEntries).toHaveLength(0);
  });
});

describe('end-to-end: submit -> approve -> verify', () => {
  it('full approval flow creates points and XP', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Champion' });
    const instructor = await createTestOwner(academy.id);

    const [seasonRecord] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Full Flow Season',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 20, 2: 15, 3: 10 },
      })
      .returning();

    // Step 1: Student submits result
    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/competition-results',
      headers: authHeaders(student),
      payload: {
        seasonId: seasonRecord.id,
        studentId: student.id,
        competitionName: 'Worlds 2026',
        competitionDate: '2026-06-01',
        position: 1,
      },
    });

    expect(submitRes.statusCode).toBe(201);
    const submitted = submitRes.json();
    expect(submitted.status).toBe('pending');
    expect(submitted.pointsAwarded).toBe(0);

    // Step 2: Instructor approves
    const approveRes = await app.inject({
      method: 'PUT',
      url: `/api/competition-results/${submitted.id}/approve`,
      headers: authHeaders(instructor),
    });

    expect(approveRes.statusCode).toBe(200);
    const approved = approveRes.json();
    expect(approved.status).toBe('approved');
    expect(approved.pointsAwarded).toBe(20);

    // Step 3: Verify XP entry
    const xpEntries = await testDb
      .select()
      .from(schema.xpEntry)
      .where(eq(schema.xpEntry.studentId, student.id));
    expect(xpEntries).toHaveLength(1);
    expect(xpEntries[0].xpAmount).toBe(200); // 20 points * 10
    expect(xpEntries[0].sourceType).toBe('competition');

    // Step 4: Verify leaderboard reflects points
    const leaderboardRes = await app.inject({
      method: 'GET',
      url: `/api/seasons/${seasonRecord.id}/leaderboard`,
    });

    expect(leaderboardRes.statusCode).toBe(200);
    const leaderboard = leaderboardRes.json();
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].studentName).toBe('Champion');
    expect(Number(leaderboard[0].totalPoints)).toBe(20);
  });
});
