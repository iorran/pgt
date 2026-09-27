import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { cleanDb, createTestAcademy, createTestUser, createTestOwner, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';
import { carryOverPoints } from '../src/gamification/carried-points';

beforeEach(async () => {
  await cleanDb();
});

describe('carryOverPoints', () => {
  it('adds one approved, position-less entry per student with XP, and is idempotent', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const a = await createTestUser(academy.id, { name: 'Jeremias' });
    const b = await createTestUser(academy.id, { name: 'Jandira' });
    const [s] = await testDb.insert(schema.season).values({
      academyId: academy.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10 },
    }).returning();
    const input = {
      seasonId: s.id,
      ownerId: owner.id,
      label: 'Pontos acumulados até a Mafra Cup',
      date: '2026-09-27',
      entries: [{ studentId: a.id, points: 31 }, { studentId: b.id, points: 9 }],
    };

    expect(await carryOverPoints(input)).toEqual({ created: 2, skipped: 0 });
    expect(await carryOverPoints(input)).toEqual({ created: 0, skipped: 2 });

    const rows = await testDb.select().from(schema.competitionResult).where(eq(schema.competitionResult.seasonId, s.id));
    expect(rows.map((r) => [r.studentId, r.pointsAwarded, r.position, r.status, r.reviewedBy]).sort()).toEqual(
      [[a.id, 31, null, 'approved', owner.id], [b.id, 9, null, 'approved', owner.id]].sort(),
    );
    const xp = await testDb.select().from(schema.xpEntry).where(eq(schema.xpEntry.studentId, a.id));
    expect(xp.map((x) => x.xpAmount)).toEqual([310]);
  });
});
