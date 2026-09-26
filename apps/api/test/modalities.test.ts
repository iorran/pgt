import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

async function setup() {
  const academy = await createTestAcademy();
  const owner = await createTestOwner(academy.id);
  const student = await createTestUser(academy.id, { name: 'Ana' });
  function api(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url, headers: authHeaders(owner), payload });
  }
  return { academy, owner, student, api };
}

describe('modalities CRUD', () => {
  it('creates, lists sorted by name with studentCount, renames and deletes', async () => {
    const { student, api } = await setup();
    const mma = await api('POST', '/api/modalities', { name: '  MMA ' });
    expect(mma.statusCode).toBe(201);
    expect(mma.json()).toEqual({ id: expect.any(String), name: 'MMA', studentCount: 0 });
    const bjj = (await api('POST', '/api/modalities', { name: 'Jiu-Jitsu' })).json();
    await testDb.insert(schema.studentModality).values({ studentId: student.id, modalityId: bjj.id });

    const list = await api('GET', '/api/modalities');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([
      { id: bjj.id, name: 'Jiu-Jitsu', studentCount: 1 },
      { id: mma.json().id, name: 'MMA', studentCount: 0 },
    ]);

    const renamed = await api('PUT', `/api/modalities/${bjj.id}`, { name: 'BJJ' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toEqual({ id: bjj.id, name: 'BJJ', studentCount: 1 });

    expect((await api('DELETE', `/api/modalities/${mma.json().id}`)).statusCode).toBe(204);
    expect((await api('GET', '/api/modalities')).json()).toHaveLength(1);
  });

  it('409 MODALITY_EXISTS on duplicate name (case-insensitive, trimmed) for create and rename', async () => {
    const { api } = await setup();
    await api('POST', '/api/modalities', { name: 'Kids' });
    const other = (await api('POST', '/api/modalities', { name: 'MMA' })).json();

    const dup = await api('POST', '/api/modalities', { name: ' kids ' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: 'MODALITY_EXISTS' });

    const rename = await api('PUT', `/api/modalities/${other.id}`, { name: 'KIDS' });
    expect(rename.statusCode).toBe(409);
    expect(rename.json()).toEqual({ error: 'MODALITY_EXISTS' });

    // Renaming to its own name (different case) is fine.
    expect((await api('PUT', `/api/modalities/${other.id}`, { name: 'mma' })).statusCode).toBe(200);
  });

  it('same name is allowed in another academy', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.api('POST', '/api/modalities', { name: 'MMA' })).statusCode).toBe(201);
    expect((await b.api('POST', '/api/modalities', { name: 'MMA' })).statusCode).toBe(201);
  });

  it('400 on missing or blank name', async () => {
    const { api } = await setup();
    expect((await api('POST', '/api/modalities', {})).statusCode).toBe(400);
    expect((await api('POST', '/api/modalities', { name: '   ' })).statusCode).toBe(400);
    const m = (await api('POST', '/api/modalities', { name: 'MMA' })).json();
    expect((await api('PUT', `/api/modalities/${m.id}`, { name: '' })).statusCode).toBe(400);
  });

  it('DELETE 409 MODALITY_IN_USE with studentCount when a student has it', async () => {
    const { student, api } = await setup();
    const m = (await api('POST', '/api/modalities', { name: 'MMA' })).json();
    await testDb.insert(schema.studentModality).values({ studentId: student.id, modalityId: m.id });
    const res = await api('DELETE', `/api/modalities/${m.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'MODALITY_IN_USE', studentCount: 1 });
  });

  it('students can list but not write', async () => {
    const { student, api } = await setup();
    const m = (await api('POST', '/api/modalities', { name: 'MMA' })).json();
    const as = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
      app.inject({ method, url, headers: authHeaders(student), payload });
    expect((await as('GET', '/api/modalities')).statusCode).toBe(200);
    expect((await as('POST', '/api/modalities', { name: 'X' })).statusCode).toBe(403);
    expect((await as('PUT', `/api/modalities/${m.id}`, { name: 'X' })).statusCode).toBe(403);
    expect((await as('DELETE', `/api/modalities/${m.id}`)).statusCode).toBe(403);
  });

  it('404 for unknown or malformed ids', async () => {
    const { api } = await setup();
    expect((await api('PUT', '/api/modalities/not-a-uuid', { name: 'X' })).statusCode).toBe(404);
    expect((await api('DELETE', '/api/modalities/00000000-0000-0000-0000-000000000000')).statusCode).toBe(404);
  });
});
