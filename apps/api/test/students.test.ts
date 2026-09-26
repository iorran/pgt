import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });
afterEach(() => { vi.useRealTimers(); });

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const [bjj, mma] = await testDb.insert(schema.modality).values([
    { academyId: academy.id, name: 'Jiu-Jitsu' },
    { academyId: academy.id, name: 'MMA' },
  ]).returning();
  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }
  return { academy, owner, bjj, mma, api };
}

describe('GET /api/students', () => {
  it('lists students with Monthly Fee, modalities and training note', async () => {
    const { academy, bjj, mma, api } = await setup();
    const student = await createTestUser(academy.id, { name: 'Ana Silva', belt: 'blue', trainingNote: 'turma das 7h' });
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, monthlyFee: '45.00', startDate: '2025-01-01', dueDay: 10,
    });
    await testDb.insert(schema.studentModality).values([
      { studentId: student.id, modalityId: mma.id },
      { studentId: student.id, modalityId: bjj.id },
    ]);

    const res = await api('GET', `/api/students?academyId=${academy.id}`);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      id: student.id,
      name: 'Ana Silva',
      email: student.email,
      belt: 'blue',
      phone: null,
      dateOfBirth: null,
      dueDay: 10,
      monthlyFee: '45.00',
      modalities: [{ id: bjj.id, name: 'Jiu-Jitsu' }, { id: mma.id, name: 'MMA' }],
      trainingNote: 'turma das 7h',
      familyId: null,
      familyName: null,
    });
  });

  it('returns students without membership (fee null, no modalities)', async () => {
    const { academy, api } = await setup();
    await createTestUser(academy.id, { name: 'No Fee Student' });

    const body = (await api('GET', '/api/students')).json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ monthlyFee: null, dueDay: null, modalities: [], trainingNote: null });
  });

  it('filters by ?modalityId=', async () => {
    const { academy, bjj, mma, api } = await setup();
    const ana = await createTestUser(academy.id, { name: 'Ana' });
    const bia = await createTestUser(academy.id, { name: 'Bia' });
    await createTestUser(academy.id, { name: 'Caio' });
    await testDb.insert(schema.studentModality).values([
      { studentId: ana.id, modalityId: bjj.id },
      { studentId: ana.id, modalityId: mma.id },
      { studentId: bia.id, modalityId: mma.id },
    ]);

    const onlyBjj = (await api('GET', `/api/students?modalityId=${bjj.id}`)).json();
    expect(onlyBjj.map((s: any) => s.name)).toEqual(['Ana']);
    // The filtered row still carries all of the student's modalities.
    expect(onlyBjj[0].modalities).toHaveLength(2);
    const onlyMma = (await api('GET', `/api/students?modalityId=${mma.id}`)).json();
    expect(onlyMma.map((s: any) => s.name).sort()).toEqual(['Ana', 'Bia']);
    expect((await api('GET', '/api/students')).json()).toHaveLength(3);
    const bogus = await api('GET', '/api/students?modalityId=nope');
    expect(bogus.statusCode).toBe(200);
    expect(bogus.json()).toEqual([]);
  });

  it('does not list owners', async () => {
    const { academy, api } = await setup();
    await createTestUser(academy.id, { name: 'Student' });
    await createTestOwner(academy.id, { name: 'Instructor' });

    const body = (await api('GET', '/api/students')).json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Student');
  });
});

describe('GET /api/students/:id', () => {
  it('returns the student with fee, modalities, note and membership start', async () => {
    const { academy, owner, mma } = await setup();
    const student = await createTestUser(academy.id, { name: 'Carlos', trainingNote: 'trânsito livre' });
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, monthlyFee: '60.00', startDate: '2025-03-01', dueDay: 5,
    });
    await testDb.insert(schema.studentModality).values({ studentId: student.id, modalityId: mma.id });

    const res = await app.inject({ method: 'GET', url: `/api/students/${student.id}`, headers: authHeaders(owner) });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      id: student.id,
      name: 'Carlos',
      image: null,
      monthlyFee: '60.00',
      dueDay: 5,
      membershipStartDate: '2025-03-01',
      modalities: [{ id: mma.id, name: 'MMA' }],
      trainingNote: 'trânsito livre',
      familyId: null,
      familyName: null,
    });
    expect(body.createdAt).toBeTruthy();
    for (const gone of ['planName', 'planId', 'planPrice', 'agreedPrice']) {
      expect(body).not.toHaveProperty(gone);
    }
  });

  it('returns student without membership', async () => {
    const { academy, owner } = await setup();
    const student = await createTestUser(academy.id, { name: 'New Student' });

    const res = await app.inject({ method: 'GET', url: `/api/students/${student.id}`, headers: authHeaders(owner) });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'New Student', monthlyFee: null, membershipStartDate: null, modalities: [], trainingNote: null });
  });

  it('allows same-academy owner to read a student profile', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const student = await createTestUser(academy.id, { name: 'Owned Student' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(owner),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Owned Student');
  });

  it('allows the student themselves to read their own profile', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Self' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Self');
  });

  it('returns 401 when unauthenticated', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${student.id}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a student reading another student', async () => {
    const academy = await createTestAcademy();
    const a = await createTestUser(academy.id);
    const b = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${b.id}`,
      headers: authHeaders(a),
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 for a cross-academy instructor', async () => {
    const academyA = await createTestAcademy();
    const academyB = await createTestAcademy();
    const instructorB = await createTestOwner(academyB.id);
    const studentA = await createTestUser(academyA.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/students/${studentA.id}`,
      headers: authHeaders(instructorB),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/students/:id/membership', () => {
  it('creates the active membership if missing, with defaults dueDay 8 and first day of next month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 15, 12)); // 2026-12-15
    const { academy, api } = await setup();
    const student = await createTestUser(academy.id);

    const res = await api('PUT', `/api/students/${student.id}/membership`, { monthlyFee: '45.00' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ studentId: student.id, monthlyFee: '45.00', dueDay: 8, startDate: '2027-01-01', active: true });
  });

  it('creates with the given dueDay and startDate', async () => {
    const { academy, api } = await setup();
    const student = await createTestUser(academy.id);
    const res = await api('PUT', `/api/students/${student.id}/membership`, { monthlyFee: '0', dueDay: 28, startDate: '2026-05-01' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ monthlyFee: '0.00', dueDay: 28, startDate: '2026-05-01' });
  });

  it('updates the active membership, keeping fields not sent and ignoring others', async () => {
    const { academy, api } = await setup();
    const student = await createTestUser(academy.id);
    await testDb.insert(schema.studentMembership).values({
      studentId: student.id, monthlyFee: '45.00', startDate: '2025-01-01', dueDay: 10,
    });

    const res = await api('PUT', `/api/students/${student.id}/membership`, {
      monthlyFee: '65.00', active: false, notificationsMuted: true, studentId: 'x',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      studentId: student.id, monthlyFee: '65.00', dueDay: 10, startDate: '2025-01-01', active: true, notificationsMuted: false,
    });
    const rows = await testDb.select().from(schema.studentMembership).where(eq(schema.studentMembership.studentId, student.id));
    expect(rows).toHaveLength(1);

    const moved = await api('PUT', `/api/students/${student.id}/membership`, { monthlyFee: '65.00', dueDay: 3 });
    expect(moved.json()).toMatchObject({ dueDay: 3, startDate: '2025-01-01' });
  });

  it('400 on invalid fee, dueDay or startDate', async () => {
    const { academy, api } = await setup();
    const student = await createTestUser(academy.id);
    const url = `/api/students/${student.id}/membership`;
    for (const payload of [
      {},
      { monthlyFee: '-1' },
      { monthlyFee: 'abc' },
      { monthlyFee: '1.234' },
      { monthlyFee: null },
      { monthlyFee: '45', dueDay: 0 },
      { monthlyFee: '45', dueDay: 29 },
      { monthlyFee: '45', dueDay: 2.5 },
      { monthlyFee: '45', startDate: '2026/01/01' },
    ]) {
      expect((await api('PUT', url, payload)).statusCode, JSON.stringify(payload)).toBe(400);
    }
    const rows = await testDb.select().from(schema.studentMembership).where(eq(schema.studentMembership.studentId, student.id));
    expect(rows).toHaveLength(0);
  });

  it('student cannot set a fee; another academy student is 404', async () => {
    const a = await setup();
    const b = await setup();
    const student = await createTestUser(a.academy.id);
    const other = await createTestUser(b.academy.id);
    const asStudent = await app.inject({
      method: 'PUT', url: `/api/students/${student.id}/membership`, headers: authHeaders(student), payload: { monthlyFee: '0' },
    });
    expect(asStudent.statusCode).toBe(403);
    expect((await a.api('PUT', `/api/students/${other.id}/membership`, { monthlyFee: '45' })).statusCode).toBe(404);
  });

  it('POST /api/students/:id/membership is gone', async () => {
    const { academy, api } = await setup();
    const student = await createTestUser(academy.id);
    expect((await api('POST', `/api/students/${student.id}/membership`, { monthlyFee: '45' })).statusCode).toBe(404);
  });
});

describe('PUT /api/students/:id/training', () => {
  it('replaces modalities and sets the training note', async () => {
    const { academy, bjj, mma, api } = await setup();
    const student = await createTestUser(academy.id);
    await testDb.insert(schema.studentModality).values({ studentId: student.id, modalityId: bjj.id });

    const res = await api('PUT', `/api/students/${student.id}/training`, { modalityIds: [mma.id, mma.id], trainingNote: ' trânsito livre ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ modalities: [{ id: mma.id, name: 'MMA' }], trainingNote: 'trânsito livre' });

    const cleared = await api('PUT', `/api/students/${student.id}/training`, { modalityIds: [], trainingNote: null });
    expect(cleared.json()).toEqual({ modalities: [], trainingNote: null });
    const links = await testDb.select().from(schema.studentModality).where(eq(schema.studentModality.studentId, student.id));
    expect(links).toHaveLength(0);
  });

  it('404 when a modality belongs to another academy (nothing changes)', async () => {
    const a = await setup();
    const b = await setup();
    const student = await createTestUser(a.academy.id, { trainingNote: 'keep' });
    await testDb.insert(schema.studentModality).values({ studentId: student.id, modalityId: a.bjj.id });

    const res = await a.api('PUT', `/api/students/${student.id}/training`, { modalityIds: [a.mma.id, b.mma.id], trainingNote: 'x' });
    expect(res.statusCode).toBe(404);
    const links = await testDb.select().from(schema.studentModality).where(and(eq(schema.studentModality.studentId, student.id)));
    expect(links.map((l) => l.modalityId)).toEqual([a.bjj.id]);
    const [row] = await testDb.select().from(schema.user).where(eq(schema.user.id, student.id));
    expect(row.trainingNote).toBe('keep');
  });

  it('400 on bad body, 404 for another academy student, 403 for students', async () => {
    const a = await setup();
    const b = await setup();
    const student = await createTestUser(a.academy.id);
    const other = await createTestUser(b.academy.id);
    const url = `/api/students/${student.id}/training`;
    expect((await a.api('PUT', url, { trainingNote: null })).statusCode).toBe(400);
    expect((await a.api('PUT', url, { modalityIds: 'x', trainingNote: null })).statusCode).toBe(400);
    expect((await a.api('PUT', url, { modalityIds: [], trainingNote: 5 })).statusCode).toBe(400);
    expect((await a.api('PUT', `/api/students/${other.id}/training`, { modalityIds: [], trainingNote: null })).statusCode).toBe(404);
    const asStudent = await app.inject({ method: 'PUT', url, headers: authHeaders(student), payload: { modalityIds: [], trainingNote: null } });
    expect(asStudent.statusCode).toBe(403);
  });
});
