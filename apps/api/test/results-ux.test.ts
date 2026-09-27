import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const student = await createTestUser(academy.id, { name: 'Bia' });
  const [s2025] = await testDb.insert(schema.season).values({
    academyId: academy.id, name: '2025', startDate: '2025-01-01', endDate: '2025-12-31', pointsConfig: { 1: 5, 2: 3, 3: 1 },
  }).returning();
  const [s2026] = await testDb.insert(schema.season).values({
    academyId: academy.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10, 2: 7, 3: 5 },
  }).returning();
  return { academy, owner, student, s2025, s2026 };
}

const submit = (who: any, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/competition-results', headers: authHeaders(who), payload });

describe('POST /api/competition-results without seasonId', () => {
  it('picks the season whose range contains the competition date', async () => {
    const { student, s2025, s2026 } = await setup();
    const a = await submit(student, { studentId: student.id, competitionName: 'Open', competitionDate: '2026-09-20', position: 1 });
    expect(a.statusCode).toBe(201);
    expect(a.json().seasonId).toBe(s2026.id);
    expect(a.json().status).toBe('pending');
    const b = await submit(student, { studentId: student.id, competitionName: 'Old', competitionDate: '2025-06-01', position: 2 });
    expect(b.json().seasonId).toBe(s2025.id);
  });

  it('returns 422 NO_SEASON_FOR_DATE when no season covers the date', async () => {
    const { student } = await setup();
    const res = await submit(student, { studentId: student.id, competitionName: 'Future', competitionDate: '2027-02-01', position: 1 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('NO_SEASON_FOR_DATE');
  });

  it('rejects positions outside the podium', async () => {
    const { student } = await setup();
    const res = await submit(student, { studentId: student.id, competitionName: 'X', competitionDate: '2026-05-01', position: 4 });
    expect(res.statusCode).toBe(400);
  });
});

describe('owner registers a result', () => {
  it('is approved immediately with points, reviewer and XP', async () => {
    const { owner, student } = await setup();
    const res = await submit(owner, { studentId: student.id, competitionName: 'Europeu', competitionDate: '2026-04-10', position: 2 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ status: 'approved', pointsAwarded: 7, reviewedBy: owner.id });
    const [xp] = await testDb.select().from(schema.xpEntry).where(eq(schema.xpEntry.studentId, student.id));
    expect(xp.xpAmount).toBe(70);
  });
});

describe('GET /api/competition-results/mine', () => {
  it('lists only my results, newest competition first, with season name and status', async () => {
    const { owner, student, academy } = await setup();
    const other = await createTestUser(academy.id, { name: 'Other' });
    await submit(student, { studentId: student.id, competitionName: 'Old', competitionDate: '2025-06-01', position: 3 });
    await submit(owner, { studentId: student.id, competitionName: 'New', competitionDate: '2026-08-01', position: 1 });
    await submit(other, { studentId: other.id, competitionName: 'Not mine', competitionDate: '2026-08-02', position: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/competition-results/mine', headers: authHeaders(student) });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((r: any) => [r.competitionName, r.status, r.pointsAwarded, r.seasonName])).toEqual([
      ['New', 'approved', 10, '2026'],
      ['Old', 'pending', 0, '2025'],
    ]);
  });

  it('requires login', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/competition-results/mine' });
    expect(res.statusCode).toBe(401);
  });
});
