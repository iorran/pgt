import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestOwner,
  createTestClass,
  authHeaders,
  testDb,
} from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12)); // 2026-10-20
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(async () => {
  await cleanDb();
});

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const reynaldo = await createTestUser(academy.id, { name: 'Reynaldo', belt: 'black' });
  const alex = await createTestUser(academy.id, { name: 'Alex', belt: 'blue' });
  const madiba = await createTestUser(academy.id, { name: 'Madiba', belt: 'black' });
  const ana = await createTestUser(academy.id, { name: 'Ana' });
  const pedro = await createTestUser(academy.id, { name: 'Pedro' });
  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }
  return { academy, owner, reynaldo, alex, madiba, ana, pedro, api };
}

const noGiBody = (teacherIds: string[]) => ({ name: 'No Gi', sharePercent: 50, addOnPrice: '10', teacherIds });

describe('teacher agreements', () => {
  it('creates, lists and edits agreements with their teachers', async () => {
    const { api, reynaldo, alex, madiba } = await setup();
    const created = await api('POST', '/api/agreements', { ...noGiBody([reynaldo.id, alex.id]), name: ' No Gi ' });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: 'No Gi',
      sharePercent: 50,
      addOnPrice: '10.00',
      active: true,
      teachers: [
        { id: alex.id, name: 'Alex' },
        { id: reynaldo.id, name: 'Reynaldo' },
      ],
      students: { recruited: 0, addOn: 0 },
    });
    await api('POST', '/api/agreements', { name: 'Tarde', sharePercent: 50, addOnPrice: null, teacherIds: [madiba.id] });

    const list = (await api('GET', '/api/agreements')).json();
    expect(list.map((a: any) => [a.name, a.addOnPrice])).toEqual([
      ['No Gi', '10.00'],
      ['Tarde', null],
    ]);

    const id = created.json().id;
    const edited = await api('PUT', `/api/agreements/${id}`, {
      name: 'No Gi',
      sharePercent: 40,
      addOnPrice: '15.5',
      teacherIds: [reynaldo.id],
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json()).toMatchObject({
      sharePercent: 40,
      addOnPrice: '15.50',
      teachers: [{ id: reynaldo.id, name: 'Reynaldo' }],
    });
  });

  it('validates input, teachers and tenancy; owner only', async () => {
    const { api, academy, owner, reynaldo, ana } = await setup();
    const other = await setup();
    const pending = await createTestUser(academy.id, { name: 'Pending', status: 'pending' });
    for (const bad of [
      { ...noGiBody([reynaldo.id]), name: '' },
      { ...noGiBody([reynaldo.id]), name: 'x'.repeat(51) },
      { ...noGiBody([reynaldo.id]), sharePercent: 101 },
      { ...noGiBody([reynaldo.id]), sharePercent: 2.5 },
      { ...noGiBody([reynaldo.id]), addOnPrice: '-1' },
      noGiBody([]),
    ]) {
      const res = await api('POST', '/api/agreements', bad);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_AGREEMENT' });
    }
    for (const teacherId of [owner.id, other.reynaldo.id, pending.id, 'nope']) {
      const res = await api('POST', '/api/agreements', noGiBody([teacherId]));
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_PAYOUT_TEACHER' });
    }
    const theirs = (await other.api('POST', '/api/agreements', noGiBody([other.reynaldo.id]))).json();
    expect((await api('PUT', `/api/agreements/${theirs.id}`, noGiBody([reynaldo.id]))).statusCode).toBe(404);
    expect((await api('POST', `/api/agreements/${theirs.id}/end`)).statusCode).toBe(404);
    expect((await api('GET', '/api/agreements')).json()).toEqual([]);
    const asStudent = await app.inject({ method: 'GET', url: '/api/agreements', headers: authHeaders(ana) });
    expect(asStudent.statusCode).toBe(403);
  });
});

describe('linking a Student to an agreement', () => {
  it('links as add-on or recruited, at most one agreement, and shows it on the student', async () => {
    const { api, academy, owner, reynaldo, madiba, ana } = await setup();
    const noGi = (await api('POST', '/api/agreements', noGiBody([reynaldo.id]))).json();
    const tarde = (
      await api('POST', '/api/agreements', { name: 'Tarde', sharePercent: 50, addOnPrice: null, teacherIds: [madiba.id] })
    ).json();

    const res = await api('PUT', `/api/students/${ana.id}/finance`, { agreementId: noGi.id, kind: 'addOn' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ agreementId: noGi.id, agreementKind: 'addOn' });

    const cls = await createTestClass(academy.id, { teacherId: reynaldo.id, instructorId: owner.id });
    await testDb.insert(schema.checkin).values({ classId: cls.id, studentId: ana.id, checkedInAt: new Date(2026, 9, 5, 19) });
    expect((await api('GET', `/api/students/${ana.id}`)).json()).toMatchObject({
      agreementId: noGi.id,
      agreementKind: 'addOn',
      agreementCheckins: 1,
    });

    // Moving to another agreement replaces the link.
    const moved = await api('PUT', `/api/students/${ana.id}/finance`, { agreementId: tarde.id, kind: 'recruited' });
    expect(moved.json()).toEqual({ agreementId: tarde.id, agreementKind: 'recruited' });
    const list = (await api('GET', '/api/agreements')).json();
    expect(list.map((a: any) => a.students)).toEqual([
      { recruited: 0, addOn: 0 },
      { recruited: 1, addOn: 0 },
    ]);

    const cleared = await api('PUT', `/api/students/${ana.id}/finance`, { agreementId: null, kind: null });
    expect(cleared.json()).toEqual({ agreementId: null, agreementKind: null });
    expect((await api('GET', `/api/students/${ana.id}`)).json()).toMatchObject({ agreementCheckins: null });
  });

  it('rejects a bad link', async () => {
    const { api, reynaldo, madiba, ana } = await setup();
    const other = await setup();
    const noGi = (await api('POST', '/api/agreements', noGiBody([reynaldo.id]))).json();
    const tarde = (
      await api('POST', '/api/agreements', { name: 'Tarde', sharePercent: 50, addOnPrice: null, teacherIds: [madiba.id] })
    ).json();
    const theirs = (await other.api('POST', '/api/agreements', noGiBody([other.reynaldo.id]))).json();
    for (const body of [
      { agreementId: noGi.id, kind: 'other' },
      { agreementId: noGi.id, kind: null },
      { agreementId: null, kind: 'addOn' },
      // No Class Add-on on this agreement.
      { agreementId: tarde.id, kind: 'addOn' },
      { agreementId: theirs.id, kind: 'recruited' },
      { agreementId: 'nope', kind: 'recruited' },
    ]) {
      const res = await api('PUT', `/api/students/${ana.id}/finance`, body);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_AGREEMENT_LINK' });
    }
    // A teacher of the agreement can't be linked to it.
    expect((await api('PUT', `/api/students/${reynaldo.id}/finance`, { agreementId: noGi.id, kind: 'recruited' })).statusCode).toBe(
      400,
    );
    expect((await api('PUT', `/api/students/${other.ana.id}/finance`, { agreementId: noGi.id, kind: 'addOn' })).statusCode).toBe(404);
    const asStudent = await app.inject({
      method: 'PUT',
      url: `/api/students/${ana.id}/finance`,
      headers: authHeaders(ana),
      payload: { agreementId: noGi.id, kind: 'addOn' },
    });
    expect(asStudent.statusCode).toBe(403);
  });

  it('refuses to drop the add-on while Students pay it', async () => {
    const { api, reynaldo, ana } = await setup();
    const noGi = (await api('POST', '/api/agreements', noGiBody([reynaldo.id]))).json();
    await api('PUT', `/api/students/${ana.id}/finance`, { agreementId: noGi.id, kind: 'addOn' });
    const res = await api('PUT', `/api/agreements/${noGi.id}`, { ...noGiBody([reynaldo.id]), addOnPrice: null });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'AGREEMENT_HAS_ADD_ON_STUDENTS' });
  });

  it('ending an agreement unlinks its Students and blocks new links', async () => {
    const { api, reynaldo, ana, pedro } = await setup();
    const noGi = (await api('POST', '/api/agreements', noGiBody([reynaldo.id]))).json();
    await api('PUT', `/api/students/${ana.id}/finance`, { agreementId: noGi.id, kind: 'addOn' });
    const ended = await api('POST', `/api/agreements/${noGi.id}/end`);
    expect(ended.statusCode).toBe(200);
    expect(ended.json()).toMatchObject({ active: false });
    expect((await api('GET', `/api/students/${ana.id}`)).json()).toMatchObject({ agreementId: null, agreementKind: null });
    expect((await api('PUT', `/api/students/${pedro.id}/finance`, { agreementId: noGi.id, kind: 'recruited' })).statusCode).toBe(400);
    expect((await api('PUT', `/api/agreements/${noGi.id}`, noGiBody([reynaldo.id]))).statusCode).toBe(400);
    expect((await api('GET', '/api/agreements')).json()).toMatchObject([{ id: noGi.id, active: false }]);
  });
});
