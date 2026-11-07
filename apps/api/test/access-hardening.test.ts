import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, createTestClass, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, who: any, payload?: object) =>
  app.inject({ method, url, headers: authHeaders(who), ...(payload ? { payload } : {}) });

describe('membership approval is enforced server-side', () => {
  it.each(['pending', 'rejected'] as const)('a %s member cannot read academy data', async (status) => {
    const academy = await createTestAcademy();
    const user = await createTestUser(academy.id, { status });
    expect((await call('GET', '/api/classes', user)).statusCode).toBe(403);
    expect((await call('GET', '/api/seasons', user)).statusCode).toBe(403);
  });

  it('a pending member cannot check in', async () => {
    const academy = await createTestAcademy();
    const cls = await createTestClass(academy.id);
    const user = await createTestUser(academy.id, { status: 'pending' });
    const res = await call('POST', '/api/checkins', user, { classId: cls.id, source: 'button', latitude: 0, longitude: 0 });
    expect(res.statusCode).toBe(403);
  });

  it('an active member still can', async () => {
    const academy = await createTestAcademy();
    const user = await createTestUser(academy.id);
    expect((await call('GET', '/api/classes', user)).statusCode).toBe(200);
  });
});

describe('season leaderboard', () => {
  it('does not expose students’ dates of birth', async () => {
    const academy = await createTestAcademy();
    const [s] = await testDb.insert(schema.season).values({
      academyId: academy.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', pointsConfig: { 1: 10 },
    }).returning();
    const kid = await createTestUser(academy.id, { name: 'Kid', dateOfBirth: '2014-05-01' });
    const peer = await createTestUser(academy.id, { name: 'Peer' });
    await testDb.insert(schema.competitionResult).values({
      seasonId: s.id, studentId: kid.id, competitionName: 'X', competitionDate: '2026-05-01', position: 1,
      submittedBy: kid.id, status: 'approved', pointsAwarded: 10,
    });

    const res = await call('GET', `/api/seasons/${s.id}/leaderboard`, peer);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0]).not.toHaveProperty('dateOfBirth');
  });
});

describe('family routes only touch members of the owner’s academy', () => {
  async function setup() {
    const a = await createTestAcademy();
    const b = await createTestAcademy();
    const owner = await createTestOwner(a.id);
    const resp = await createTestUser(a.id, { name: 'Resp' });
    const moved = await createTestUser(a.id, { name: 'Moved', email: 'moved@example.com' });
    const [fam] = await testDb.insert(schema.family).values({ academyId: a.id, name: 'F', responsibleUserId: resp.id }).returning();
    await testDb.update(schema.user).set({ familyId: fam.id }).where(eq(schema.user.academyId, a.id));
    await testDb.update(schema.user).set({ familyId: null }).where(eq(schema.user.id, owner.id));
    // The member later joined another academy; the old family link is stale.
    await testDb.update(schema.user).set({ academyId: b.id }).where(eq(schema.user.id, moved.id));
    return { owner, resp, moved, fam };
  }

  it('cannot rewrite the email of a member who moved to another academy', async () => {
    const { owner, moved, fam } = await setup();
    const res = await call('DELETE', `/api/families/${fam.id}/members/${moved.id}`, owner, { email: 'attacker@example.com' });
    expect(res.statusCode).toBe(404);
    const [u] = await testDb.select().from(schema.user).where(eq(schema.user.id, moved.id));
    expect(u.email).toBe('moved@example.com');
  });

  it('cannot make a member of another academy the Responsible', async () => {
    const { owner, moved, fam } = await setup();
    const res = await call('PUT', `/api/families/${fam.id}/responsible`, owner, { userId: moved.id });
    expect(res.statusCode).toBe(400);
  });

  it('leaves members of another academy out of family billing', async () => {
    const { owner, resp, moved, fam } = await setup();
    await testDb.insert(schema.studentMembership).values([resp, moved].map((u) => ({
      studentId: u.id, monthlyFee: '50.00', dueDay: 1, startDate: '2026-01-01', active: true,
    })));
    const res = await call('GET', `/api/families/${fam.id}/billing`, owner);
    expect(res.statusCode).toBe(200);
    const body = JSON.stringify(res.json());
    expect(body).toContain(resp.id);
    expect(body).not.toContain(moved.id);
  });

  it('the Responsible can no longer act as, or list, a member who moved academy', async () => {
    const { resp, moved } = await setup();
    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${moved.id}`,
      headers: { ...authHeaders(resp), 'x-acting-as': moved.id },
    });
    expect(res.statusCode).toBe(403);
    const profiles = await call('GET', '/api/me/profiles', resp);
    expect(profiles.json().dependents.map((d: any) => d.id)).not.toContain(moved.id);
  });

  it('cannot replace the email of a member who already has their own login', async () => {
    const { owner, fam } = await setup();
    const withLogin = await createTestUser(owner.academyId, { name: 'Has login', email: 'own@example.com', familyId: fam.id });
    await testDb.insert(schema.account).values({
      id: crypto.randomUUID(), accountId: withLogin.id, providerId: 'credential', userId: withLogin.id, password: 'x',
    });
    const res = await call('DELETE', `/api/families/${fam.id}/members/${withLogin.id}`, owner, { email: 'attacker@example.com' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('MEMBER_HAS_LOGIN');
    const [u] = await testDb.select().from(schema.user).where(eq(schema.user.id, withLogin.id));
    expect(u.email).toBe('own@example.com');
    expect(u.familyId).toBe(fam.id);
  });
});
