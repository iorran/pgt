import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

const setBelt = (who: any, id: string, belt: unknown) =>
  app.inject({ method: 'PUT', url: `/api/students/${id}/belt`, headers: authHeaders(who), payload: { belt } });

describe('PUT /api/students/:id/belt', () => {
  it('lets the owner set kids and adult belts', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const kid = await createTestUser(academy.id);
    const kidRes = await setBelt(owner, kid.id, 'orange-white');
    expect(kidRes.statusCode).toBe(200);
    expect(kidRes.json()).toEqual({ id: kid.id, belt: 'orange-white' });
    expect((await setBelt(owner, kid.id, 'blue')).json().belt).toBe('blue');
  });

  it('rejects unknown belts', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const s = await createTestUser(academy.id);
    expect((await setBelt(owner, s.id, 'rainbow')).statusCode).toBe(400);
  });

  it('is owner-only and academy-scoped', async () => {
    const a = await createTestAcademy();
    const b = await createTestAcademy();
    const ownerB = await createTestOwner(b.id);
    const student = await createTestUser(a.id);
    expect((await setBelt(ownerB, student.id, 'blue')).statusCode).toBe(404);
    expect((await setBelt(student, student.id, 'black')).statusCode).toBe(403);
  });
});

const setBirthDate = (who: any, id: string, dateOfBirth: unknown) =>
  app.inject({ method: 'PUT', url: `/api/students/${id}/birth-date`, headers: authHeaders(who), payload: { dateOfBirth } });

describe('PUT /api/students/:id/birth-date', () => {
  it('lets the owner set and clear the birth date', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const s = await createTestUser(academy.id);
    const res = await setBirthDate(owner, s.id, '2012-05-03');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: s.id, dateOfBirth: '2012-05-03' });
    expect((await setBirthDate(owner, s.id, null)).json().dateOfBirth).toBeNull();
  });

  it('rejects invalid and future dates', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestOwner(academy.id);
    const s = await createTestUser(academy.id);
    for (const bad of ['03/05/2012', '2012-13-01', '2012-02-30', '2999-01-01', 42]) {
      expect((await setBirthDate(owner, s.id, bad)).statusCode).toBe(400);
    }
  });

  it('is owner-only and academy-scoped', async () => {
    const a = await createTestAcademy();
    const b = await createTestAcademy();
    const ownerB = await createTestOwner(b.id);
    const student = await createTestUser(a.id);
    expect((await setBirthDate(ownerB, student.id, '2012-05-03')).statusCode).toBe(404);
    expect((await setBirthDate(student, student.id, '2012-05-03')).statusCode).toBe(403);
  });
});
