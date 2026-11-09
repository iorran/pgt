import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
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

describe('check-in requires a presence proof', () => {
  async function setup() {
    const academy = await createTestAcademy();
    const cls = await createTestClass(academy.id);
    const student = await createTestUser(academy.id);
    return { cls, student };
  }

  it.each([
    ['missing', {}],
    ['null', { source: null }],
    ['unknown', { source: 'manual' }],
  ])('rejects a %s source', async (_label, extra) => {
    const { cls, student } = await setup();
    const res = await call('POST', '/api/checkins', student, { classId: cls.id, ...extra });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_SOURCE');
    expect(await testDb.select().from(schema.checkin)).toHaveLength(0);
  });

  it('rejects non-numeric coordinates for a location check-in', async () => {
    const { cls, student } = await setup();
    const res = await call('POST', '/api/checkins', student, { classId: cls.id, source: 'button', latitude: 'NaN', longitude: 'NaN' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('LOCATION_NOT_SET');
  });
});

describe('becoming a Dependent ends existing logins (ADR 0004)', () => {
  async function sessionFor(userId: string) {
    await testDb.insert(schema.session).values({
      userId, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000),
    });
  }
  const sessionsOf = async (ids: string[]) =>
    (await testDb.select().from(schema.session).where(inArray(schema.session.userId, ids))).map((s) => s.userId);

  async function setup() {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const resp = await createTestUser(academy.id, { name: 'Resp' });
    const kid = await createTestUser(academy.id, { name: 'Kid' });
    const extra = await createTestUser(academy.id, { name: 'Extra' });
    for (const u of [resp, kid, extra]) {
      await sessionFor(u.id);
    }
    return { owner, resp, kid, extra };
  }

  it('creating a family revokes the members’ sessions, not the Responsible’s', async () => {
    const { owner, resp, kid } = await setup();
    const res = await call('POST', '/api/families', owner, { name: 'F', memberIds: [resp.id, kid.id], responsibleId: resp.id });
    expect(res.statusCode).toBe(201);
    expect(await sessionsOf([resp.id, kid.id])).toEqual([resp.id]);
  });

  it('adding a member revokes their sessions', async () => {
    const { owner, resp, kid, extra } = await setup();
    const fam = (await call('POST', '/api/families', owner, { name: 'F', memberIds: [resp.id, kid.id], responsibleId: resp.id })).json();
    const res = await call('POST', `/api/families/${fam.id}/members`, owner, { studentId: extra.id });
    expect(res.statusCode).toBe(200);
    expect(await sessionsOf([extra.id])).toEqual([]);
  });

  it('moving the Responsible role away revokes the previous Responsible’s sessions', async () => {
    const { owner, resp, kid } = await setup();
    const fam = (await call('POST', '/api/families', owner, { name: 'F', memberIds: [resp.id, kid.id], responsibleId: resp.id })).json();
    await sessionFor(kid.id);
    const res = await call('PUT', `/api/families/${fam.id}/responsible`, owner, { userId: kid.id });
    expect(res.statusCode).toBe(200);
    expect(await sessionsOf([resp.id, kid.id])).toEqual([kid.id]);
    const [r] = await testDb.select().from(schema.user).where(eq(schema.user.id, resp.id));
    expect(r.familyId).toBe(fam.id);
  });
});

describe('class PUT only writes editable fields', () => {
  async function setup() {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const other = await createTestOwner((await createTestAcademy()).id);
    return { academy, owner, other };
  }

  it('class: keeps instructorId, edits the schedule', async () => {
    const { academy, owner, other } = await setup();
    const cls = await createTestClass(academy.id, { instructorId: owner.id });
    const res = await call('PUT', `/api/classes/${cls.id}`, owner, { instructorId: other.id, startTime: '20:00', name: 'Gi noite' });
    expect(res.statusCode).toBe(200);
    const [row] = await testDb.select().from(schema.bjjClass).where(eq(schema.bjjClass.id, cls.id));
    expect(row).toMatchObject({ instructorId: owner.id, startTime: '20:00:00', name: 'Gi noite' });
  });


  it('class: 400 when nothing editable is sent', async () => {
    const { academy, owner, other } = await setup();
    const cls = await createTestClass(academy.id, { instructorId: owner.id });
    expect((await call('PUT', `/api/classes/${cls.id}`, owner, { instructorId: other.id })).statusCode).toBe(400);
  });
});
