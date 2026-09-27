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
