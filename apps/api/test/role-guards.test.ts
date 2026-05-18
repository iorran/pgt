import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema/index.js';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, authHeaders, testDb } from './helpers.js';

describe('requireOwner (plain owner-role gate) via POST /api/classes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  const body = { name: 'Gi', type: 'gi', recurrence: 'weekly', dayOfWeek: 1, startTime: '07:00', endTime: '08:30' };

  it('owner -> not 403', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const res = await app.inject({ method: 'POST', url: '/api/classes', headers: authHeaders(owner), payload: { ...body, instructorId: owner.id } });
    expect(res.statusCode).not.toBe(403);
  });

  it('student -> 403', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { role: 'student' });
    const res = await app.inject({ method: 'POST', url: '/api/classes', headers: authHeaders(student), payload: body });
    expect(res.statusCode).toBe(403);
  });

  it('no session -> 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/classes', payload: body });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAcademyOwner via GET /api/owner/students', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(); });

  it('owner who owns the academy -> 200', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    await testDb.update(schema.academy).set({ ownerId: owner.id }).where(eq(schema.academy.id, academy.id));
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(200);
  });

  it('owner who does NOT own the academy -> 403', async () => {
    const academy = await createTestAcademy();
    const owner = await createTestUser(academy.id, { role: 'owner' });
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(owner) });
    expect(res.statusCode).toBe(403);
  });

  it('student -> 403', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { role: 'student' });
    const res = await app.inject({ method: 'GET', url: '/api/owner/students', headers: authHeaders(student) });
    expect(res.statusCode).toBe(403);
  });
});
