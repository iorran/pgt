import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestUser,
  createTestInstructor,
  authHeaders,
  testDb,
} from './helpers';
import { academy } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await cleanDb();
});

describe('POST /api/academies', () => {
  it('creates an academy and updates user to instructor', async () => {
    const user = await createTestUser(null, { role: 'student', status: 'active' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/academies',
      headers: authHeaders(user),
      payload: { name: 'Arte Suave BJJ', city: 'Sao Paulo' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Arte Suave BJJ');
    expect(body.city).toBe('Sao Paulo');
    expect(body.joinCode).toBeDefined();
    expect(body.id).toBeDefined();
  });
});

describe('GET /api/academies/by-code/:code', () => {
  it('returns academy when code exists', async () => {
    const acad = await createTestAcademy({ name: 'Gracie Barra', joinCode: 'GB-123' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/academies/by-code/GB-123',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(acad.id);
    expect(body.name).toBe('Gracie Barra');
  });

  it('returns 404 when code does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/academies/by-code/NONEXISTENT',
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/academies/:id/join', () => {
  it('sets user status to pending when joining an academy', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(null, { role: 'student', status: 'active' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/academies/${acad.id}/join`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('pending');
  });

  it('returns 404 for non-existent academy', async () => {
    const student = await createTestUser(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/academies/00000000-0000-0000-0000-000000000000/join',
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/academies/:id/pending', () => {
  it('lists pending students for the academy', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    await createTestUser(acad.id, { status: 'pending', name: 'Pending Student' });
    await createTestUser(acad.id, { status: 'active', name: 'Active Student' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/academies/${acad.id}/pending`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Pending Student');
  });
});

describe('POST /api/academies/:id/approve/:userId', () => {
  it('approves a pending student', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { status: 'pending' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/academies/${acad.id}/approve/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('active');
  });

  it('returns 404 when student is not pending', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { status: 'active' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/academies/${acad.id}/approve/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/academies/:id/reject/:userId', () => {
  it('rejects a pending student', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { status: 'pending' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/academies/${acad.id}/reject/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('rejected');
  });

  it('returns 404 when student is not pending', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);
    const student = await createTestUser(acad.id, { status: 'active' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/academies/${acad.id}/reject/${student.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/academies/mine', () => {
  it('returns the academy for the authenticated user', async () => {
    const acad = await createTestAcademy({ name: 'My Academy' });
    const instructor = await createTestInstructor(acad.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/academies/mine',
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('My Academy');
  });

  it('returns 404 when user has no academy', async () => {
    const user = await createTestUser(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/academies/mine',
      headers: authHeaders(user),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/academies/:id/location', () => {
  it('requires instructor role', async () => {
    const acad = await createTestAcademy();
    const student = await createTestUser(acad.id, { role: 'student' });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/academies/${acad.id}/location`,
      headers: authHeaders(student),
      payload: { latitude: -23.55, longitude: -46.63, address: 'Rua Test' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('updates academy location', async () => {
    const acad = await createTestAcademy();
    const instructor = await createTestInstructor(acad.id);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/academies/${acad.id}/location`,
      headers: authHeaders(instructor),
      payload: { latitude: -23.5505, longitude: -46.6333, address: 'Rua Augusta, 123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.latitude).toBe('-23.5505000');
    expect(body.longitude).toBe('-46.6333000');
    expect(body.address).toBe('Rua Augusta, 123');
  });
});
