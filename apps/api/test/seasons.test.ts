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
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/seasons', () => {
  it('returns seasons for the academy', async () => {
    const academy = await createTestAcademy();
    await testDb.insert(schema.season).values({
      academyId: academy.id,
      name: 'Season 1',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      pointsConfig: { 1: 10, 2: 7, 3: 5 },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Season 1');
  });

  it('returns empty array when no seasons exist', async () => {
    const academy = await createTestAcademy();

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('GET /api/seasons/:id', () => {
  it('returns a single season by id', async () => {
    const academy = await createTestAcademy();
    const [created] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Season 2',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        pointsConfig: { 1: 10, 2: 7, 3: 5 },
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Season 2');
    expect(body.pointsConfig).toEqual({ 1: 10, 2: 7, 3: 5 });
  });
});

describe('POST /api/seasons', () => {
  it('instructor creates a season with pointsConfig', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/seasons',
      headers: authHeaders(instructor),
      payload: {
        name: 'Championship 2026',
        startDate: '2026-03-01',
        endDate: '2026-12-31',
        pointsConfig: { 1: 15, 2: 10, 3: 7, 5: 3 },
        prizeDescription: 'Gold medal and gi',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Championship 2026');
    expect(body.pointsConfig).toEqual({ 1: 15, 2: 10, 3: 7, 5: 3 });
    expect(body.prizeDescription).toBe('Gold medal and gi');
    expect(body.academyId).toBe(academy.id);
  });
});

describe('PUT /api/seasons/:id', () => {
  it('instructor updates a season', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const [created] = await testDb
      .insert(schema.season)
      .values({
        academyId: academy.id,
        name: 'Old Name',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        pointsConfig: { 1: 10 },
      })
      .returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/seasons/${created.id}`,
      headers: authHeaders(instructor),
      payload: {
        name: 'Updated Name',
        prizeDescription: 'New prize',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Updated Name');
    expect(body.prizeDescription).toBe('New prize');
  });
});

describe('GET /api/seasons/:id/leaderboard', () => {
  it('returns empty leaderboard when no results exist', async () => {
    const academy = await createTestAcademy();
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
      method: 'GET',
      url: `/api/seasons/${seasonRecord.id}/leaderboard`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('returns leaderboard ordered by total points', async () => {
    const academy = await createTestAcademy();
    const student1 = await createTestUser(academy.id, {
      name: 'Alice',
      belt: 'blue',
      dateOfBirth: '1995-05-10',
    });
    const student2 = await createTestUser(academy.id, {
      name: 'Bob',
      belt: 'purple',
      dateOfBirth: '1990-03-20',
    });

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

    // Alice: 10 + 7 = 17 points
    await testDb.insert(schema.competitionResult).values([
      {
        seasonId: seasonRecord.id,
        studentId: student1.id,
        competitionName: 'Comp A',
        competitionDate: '2026-02-01',
        position: 1,
        pointsAwarded: 10,
        status: 'approved',
        submittedBy: student1.id,
      },
      {
        seasonId: seasonRecord.id,
        studentId: student1.id,
        competitionName: 'Comp B',
        competitionDate: '2026-03-01',
        position: 2,
        pointsAwarded: 7,
        status: 'approved',
        submittedBy: student1.id,
      },
    ]);

    // Bob: 5 points
    await testDb.insert(schema.competitionResult).values({
      seasonId: seasonRecord.id,
      studentId: student2.id,
      competitionName: 'Comp A',
      competitionDate: '2026-02-01',
      position: 3,
      pointsAwarded: 5,
      status: 'approved',
      submittedBy: student2.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons/${seasonRecord.id}/leaderboard`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].studentName).toBe('Alice');
    expect(Number(body[0].totalPoints)).toBe(17);
    expect(body[1].studentName).toBe('Bob');
    expect(Number(body[1].totalPoints)).toBe(5);
  });

  it('filters leaderboard by kids category', async () => {
    const academy = await createTestAcademy();
    const adult = await createTestUser(academy.id, {
      name: 'Adult',
      belt: 'blue',
      dateOfBirth: '1990-01-01',
    });
    const kid = await createTestUser(academy.id, {
      name: 'Kid',
      belt: 'white',
      dateOfBirth: '2015-06-15',
    });

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
        studentId: adult.id,
        competitionName: 'Comp',
        competitionDate: '2026-02-01',
        position: 1,
        pointsAwarded: 10,
        status: 'approved',
        submittedBy: adult.id,
      },
      {
        seasonId: seasonRecord.id,
        studentId: kid.id,
        competitionName: 'Comp Kids',
        competitionDate: '2026-02-01',
        position: 1,
        pointsAwarded: 10,
        status: 'approved',
        submittedBy: kid.id,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons/${seasonRecord.id}/leaderboard?category=kids`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentName).toBe('Kid');
  });

  it('filters leaderboard by adults category and belt', async () => {
    const academy = await createTestAcademy();
    const blueAdult = await createTestUser(academy.id, {
      name: 'Blue Belt',
      belt: 'blue',
      dateOfBirth: '1990-01-01',
    });
    const purpleAdult = await createTestUser(academy.id, {
      name: 'Purple Belt',
      belt: 'purple',
      dateOfBirth: '1992-03-15',
    });

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
        studentId: blueAdult.id,
        competitionName: 'Comp',
        competitionDate: '2026-02-01',
        position: 1,
        pointsAwarded: 10,
        status: 'approved',
        submittedBy: blueAdult.id,
      },
      {
        seasonId: seasonRecord.id,
        studentId: purpleAdult.id,
        competitionName: 'Comp',
        competitionDate: '2026-02-01',
        position: 1,
        pointsAwarded: 10,
        status: 'approved',
        submittedBy: purpleAdult.id,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/seasons/${seasonRecord.id}/leaderboard?category=adults&belt=blue`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].studentName).toBe('Blue Belt');
    expect(body[0].belt).toBe('blue');
  });
});
