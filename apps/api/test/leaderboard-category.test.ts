import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

describe('leaderboard categories (belt / birth date / Kids modality)', () => {
  it('splits Kids and Adultos like the academy ranking sheet', async () => {
    const academy = await createTestAcademy();
    const [kidsModality] = await testDb.insert(schema.modality).values({ academyId: academy.id, name: 'Kids' }).returning();
    const [s] = await testDb.insert(schema.season).values({
      academyId: academy.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10 },
    }).returning();

    const enzo = await createTestUser(academy.id, { name: 'Enzo (laranja e branca)', belt: 'orange-white' });
    const teenBlue = await createTestUser(academy.id, { name: 'Guilherme (azul, tagged Kids)', belt: 'blue' });
    const whiteKid = await createTestUser(academy.id, { name: 'Pedro (branca, Kids)', belt: 'white' });
    const whiteAdult = await createTestUser(academy.id, { name: 'Gabriel (branca, Jiu-Jitsu)', belt: 'white' });
    await testDb.insert(schema.studentModality).values([
      { studentId: teenBlue.id, modalityId: kidsModality.id },
      { studentId: whiteKid.id, modalityId: kidsModality.id },
    ]);
    await testDb.insert(schema.competitionResult).values(
      [enzo, teenBlue, whiteKid, whiteAdult].map((st) => ({
        seasonId: s.id, studentId: st.id, competitionName: 'X', competitionDate: '2026-05-01', position: 1,
        submittedBy: st.id, status: 'approved' as const, pointsAwarded: 10,
      })),
    );

    const get = async (qs: string) =>
      (await app.inject({ method: 'GET', url: `/api/seasons/${s.id}/leaderboard?${qs}`, headers: authHeaders(enzo) }))
        .json()
        .map((e: any) => e.studentName)
        .sort();

    expect(await get('category=kids')).toEqual(['Enzo (laranja e branca)', 'Pedro (branca, Kids)']);
    expect(await get('category=adults')).toEqual(['Gabriel (branca, Jiu-Jitsu)', 'Guilherme (azul, tagged Kids)']);
    expect(await get('category=adults&belt=blue')).toEqual(['Guilherme (azul, tagged Kids)']);
  });
});
