import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';
import { xpForResult } from '../src/gamification/points';
import { saveResult } from '../src/gamification/result-points';
import { carryOverPoints } from '../src/gamification/carried-points';

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
  const [s] = await testDb.insert(schema.season).values({
    academyId: academy.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10, 2: 7, 3: 5 },
  }).returning();
  return { academy, owner, student, s };
}

const inject = (who: any, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT', url: string, payload?: Record<string, unknown>) =>
  app.inject({ method, url, headers: authHeaders(who), payload });

const register = (owner: any, studentId: string, competitionDate: string, position: number, competitionName = 'Open') =>
  inject(owner, 'POST', '/api/competition-results', { studentId, competitionName, competitionDate, position });

const xpOf = (resultId: string) =>
  testDb.select().from(schema.xpEntry).where(eq(schema.xpEntry.sourceId, resultId));

async function totalOf(who: any, seasonId: string, studentId: string) {
  const res = await inject(who, 'GET', `/api/seasons/${seasonId}/leaderboard`);
  return res.json().find((r: any) => r.studentId === studentId)?.totalPoints ?? 0;
}

describe('xpForResult', () => {
  it('is points × 10 when approved, never negative, and none otherwise', () => {
    expect(xpForResult({ status: 'approved', pointsAwarded: 7 })).toBe(70);
    expect(xpForResult({ status: 'approved', pointsAwarded: -5 })).toBe(0);
    expect(xpForResult({ status: 'pending', pointsAwarded: 7 })).toBeNull();
    expect(xpForResult({ status: 'rejected', pointsAwarded: 7 })).toBeNull();
  });
});

describe('saveResult', () => {
  it('keeps exactly one XP entry per approved result and zeroes points when not approved', async () => {
    const { owner, student, s } = await setup();
    const [row] = await testDb.insert(schema.competitionResult).values({
      seasonId: s.id, studentId: student.id, competitionName: 'X', competitionDate: '2026-03-01', position: 1,
      submittedBy: owner.id, status: 'pending',
    }).returning();

    await saveResult(row.id, { status: 'approved', pointsAwarded: 10 });
    await saveResult(row.id, { pointsAwarded: 7 });
    expect((await xpOf(row.id)).map((x) => x.xpAmount)).toEqual([70]);

    await saveResult(row.id, { pointsAwarded: -3 });
    expect((await xpOf(row.id)).map((x) => x.xpAmount)).toEqual([0]);

    const rejected = await saveResult(row.id, { status: 'rejected' });
    expect(rejected.pointsAwarded).toBe(0);
    expect(await xpOf(row.id)).toEqual([]);
  });

  it('carried-over points are marked overridden', async () => {
    const { owner, student, s } = await setup();
    await carryOverPoints({ seasonId: s.id, ownerId: owner.id, label: 'Acumulados', date: '2026-01-01', entries: [{ studentId: student.id, points: 12 }] });
    const [row] = await testDb.select().from(schema.competitionResult).where(eq(schema.competitionResult.studentId, student.id));
    expect(row.pointsOverridden).toBe(true);
  });
});

describe('GET /api/competition-results', () => {
  it('lists all statuses by default, filters by status and student, newest first, with pointsOverridden', async () => {
    const { owner, student, academy, s } = await setup();
    const other = await createTestUser(academy.id, { name: 'Caio' });
    await register(owner, student.id, '2026-02-01', 1, 'A');
    await inject(student, 'POST', '/api/competition-results', { studentId: student.id, competitionName: 'B', competitionDate: '2026-05-01', position: 2 });
    await register(owner, other.id, '2026-04-01', 3, 'C');

    const all = await inject(owner, 'GET', `/api/competition-results?seasonId=${s.id}`);
    expect(all.json().map((r: any) => r.competitionName)).toEqual(['B', 'C', 'A']);
    expect(all.json()[0].pointsOverridden).toBe(false);

    const approved = await inject(owner, 'GET', `/api/competition-results?seasonId=${s.id}&status=approved`);
    expect(approved.json().map((r: any) => r.competitionName)).toEqual(['C', 'A']);

    const mine = await inject(owner, 'GET', `/api/competition-results?seasonId=${s.id}&studentId=${student.id}`);
    expect(mine.json().map((r: any) => r.competitionName)).toEqual(['B', 'A']);
  });
});

describe('PATCH /api/competition-results/:id', () => {
  it('recomputes points from the season when position changes and points were not typed', async () => {
    const { owner, student, s } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 1)).json();
    const res = await inject(owner, 'PATCH', `/api/competition-results/${id}`, { position: 3, competitionName: 'Renamed' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ position: 3, pointsAwarded: 5, pointsOverridden: false, competitionName: 'Renamed' });
    expect((await xpOf(id)).map((x) => x.xpAmount)).toEqual([50]);
    expect(await totalOf(owner, s.id, student.id)).toBe(5);
  });

  it('pending/rejected → 0 points and no XP; approving again restores season points', async () => {
    const { owner, student } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 2)).json();
    const rejected = await inject(owner, 'PATCH', `/api/competition-results/${id}`, { status: 'rejected' });
    expect(rejected.json()).toMatchObject({ status: 'rejected', pointsAwarded: 0 });
    expect(await xpOf(id)).toEqual([]);
    const approved = await inject(owner, 'PATCH', `/api/competition-results/${id}`, { status: 'approved' });
    expect(approved.json()).toMatchObject({ status: 'approved', pointsAwarded: 7 });
    expect((await xpOf(id)).map((x) => x.xpAmount)).toEqual([70]);
  });

  it('typed points are kept (overridden), survive later position edits and recalculate', async () => {
    const { owner, student, s } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 1)).json();
    const res = await inject(owner, 'PATCH', `/api/competition-results/${id}`, { pointsAwarded: 42 });
    expect(res.json()).toMatchObject({ pointsAwarded: 42, pointsOverridden: true });
    expect((await xpOf(id)).map((x) => x.xpAmount)).toEqual([420]);

    await inject(owner, 'PATCH', `/api/competition-results/${id}`, { position: 2 });
    await inject(owner, 'PUT', `/api/seasons/${s.id}`, { pointsConfig: { 1: 100, 2: 70, 3: 50 } });
    await inject(owner, 'POST', `/api/seasons/${s.id}/recalculate`);
    const [row] = await testDb.select().from(schema.competitionResult).where(eq(schema.competitionResult.id, id));
    expect(row.pointsAwarded).toBe(42);
  });

  it('accepts position null and validates position, status and points', async () => {
    const { owner, student } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 1)).json();
    const url = `/api/competition-results/${id}`;
    expect((await inject(owner, 'PATCH', url, { position: 4 })).statusCode).toBe(400);
    expect((await inject(owner, 'PATCH', url, { status: 'done' })).statusCode).toBe(400);
    expect((await inject(owner, 'PATCH', url, { pointsAwarded: 1.5 })).statusCode).toBe(400);
    const none = await inject(owner, 'PATCH', url, { position: null });
    expect(none.json()).toMatchObject({ position: null, pointsAwarded: 0 });
  });
});

describe('DELETE /api/competition-results/:id', () => {
  it('removes the result, its XP and its points from the leaderboard', async () => {
    const { owner, student, s } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 1)).json();
    await register(owner, student.id, '2026-03-01', 3);
    expect(await totalOf(owner, s.id, student.id)).toBe(15);

    const res = await inject(owner, 'DELETE', `/api/competition-results/${id}`);
    expect(res.statusCode).toBe(204);
    expect(await xpOf(id)).toEqual([]);
    expect(await totalOf(owner, s.id, student.id)).toBe(5);
  });
});

describe('POST /api/competition-results/adjustments', () => {
  it('adds and removes points as approved position-less entries', async () => {
    const { owner, student, s } = await setup();
    const plus = await inject(owner, 'POST', '/api/competition-results/adjustments', {
      studentId: student.id, points: 8, reason: 'Arbitragem', date: '2026-06-01',
    });
    expect(plus.statusCode).toBe(201);
    expect(plus.json()).toMatchObject({
      seasonId: s.id, position: null, status: 'approved', pointsAwarded: 8, pointsOverridden: true, competitionName: 'Arbitragem',
    });
    expect((await xpOf(plus.json().id)).map((x) => x.xpAmount)).toEqual([80]);

    const minus = await inject(owner, 'POST', '/api/competition-results/adjustments', {
      studentId: student.id, points: -3, reason: 'Falta', seasonId: s.id,
    });
    expect(minus.statusCode).toBe(201);
    expect((await xpOf(minus.json().id)).map((x) => x.xpAmount)).toEqual([0]);
    expect(await totalOf(owner, s.id, student.id)).toBe(5);
  });

  it('validates input and needs a season for the date', async () => {
    const { owner, student } = await setup();
    const post = (payload: Record<string, unknown>) => inject(owner, 'POST', '/api/competition-results/adjustments', payload);
    expect((await post({ studentId: student.id, points: 0, reason: 'x', date: '2026-06-01' })).statusCode).toBe(400);
    expect((await post({ studentId: student.id, points: 2.5, reason: 'x', date: '2026-06-01' })).statusCode).toBe(400);
    expect((await post({ studentId: student.id, points: 3, reason: '  ', date: '2026-06-01' })).statusCode).toBe(400);
    const none = await post({ studentId: student.id, points: 3, reason: 'x', date: '2030-01-01' });
    expect(none.statusCode).toBe(422);
    expect(none.json().error).toBe('NO_SEASON_FOR_DATE');
  });
});

describe('POST /api/seasons/:id/recalculate', () => {
  it('re-applies season points to approved podium results that were not overridden', async () => {
    const { owner, student, s } = await setup();
    const a = (await register(owner, student.id, '2026-02-01', 1)).json();
    await register(owner, student.id, '2026-03-01', 2);
    await inject(student, 'POST', '/api/competition-results', { studentId: student.id, competitionName: 'P', competitionDate: '2026-04-01', position: 1 });
    await inject(owner, 'POST', '/api/competition-results/adjustments', { studentId: student.id, points: 4, reason: 'Bônus', seasonId: s.id });

    await inject(owner, 'PUT', `/api/seasons/${s.id}`, { pointsConfig: { 1: 20, 2: 14, 3: 10 } });
    const res = await inject(owner, 'POST', `/api/seasons/${s.id}/recalculate`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ updated: 2 });
    expect(await totalOf(owner, s.id, student.id)).toBe(38);
    expect((await xpOf(a.id)).map((x) => x.xpAmount)).toEqual([200]);
  });
});

describe('access', () => {
  it('students get 403 and other academies 404', async () => {
    const { owner, student, s } = await setup();
    const { id } = (await register(owner, student.id, '2026-02-01', 1)).json();
    const otherAcademy = await createTestAcademy();
    const stranger = await createTestOwner(otherAcademy.id);

    expect((await inject(student, 'PATCH', `/api/competition-results/${id}`, { position: 2 })).statusCode).toBe(403);
    expect((await inject(student, 'DELETE', `/api/competition-results/${id}`)).statusCode).toBe(403);
    expect((await inject(student, 'POST', '/api/competition-results/adjustments', { studentId: student.id, points: 5, reason: 'x' })).statusCode).toBe(403);
    expect((await inject(student, 'POST', `/api/seasons/${s.id}/recalculate`)).statusCode).toBe(403);

    expect((await inject(stranger, 'PATCH', `/api/competition-results/${id}`, { position: 2 })).statusCode).toBe(404);
    expect((await inject(stranger, 'DELETE', `/api/competition-results/${id}`)).statusCode).toBe(404);
    expect((await inject(stranger, 'POST', '/api/competition-results/adjustments', { studentId: student.id, points: 5, reason: 'x', seasonId: s.id })).statusCode).toBe(404);
    expect((await inject(stranger, 'POST', `/api/seasons/${s.id}/recalculate`)).statusCode).toBe(404);
  });
});
