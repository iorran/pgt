import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestApp, cleanDb, createTestAcademy, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

// role, academyId and status are authority: only server routes may set them
// (academies create/join/approve), never the self-service better-auth endpoints.

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await cleanDb();
});

const origin = { origin: 'http://localhost:5173' };

async function signUp(body: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/auth/sign-up/email', headers: origin, payload: body });
}

async function userByEmail(email: string) {
  const [u] = await testDb.select().from(schema.user).where(eq(schema.user.email, email));
  return u;
}

describe('better-auth user fields', () => {
  it('sign-up ignores a client-supplied role and status', async () => {
    const res = await signUp({ name: 'X', email: 'x@example.com', password: 'secret-123', role: 'owner', status: 'active' });
    expect(res.statusCode).toBe(200);
    const u = await userByEmail('x@example.com');
    expect(u.role).toBe('student');
    expect(u.academyId).toBeNull();
  });

  it('sign-up rejects a client-supplied academyId', async () => {
    const academy = await createTestAcademy();
    const res = await signUp({ name: 'X', email: 'x@example.com', password: 'secret-123', academyId: academy.id });
    expect(res.statusCode).toBe(400);
    expect(await userByEmail('x@example.com')).toBeUndefined();
  });

  it.each([
    ['role', { role: 'owner' }],
    ['academyId', { academyId: 'target' }],
    ['status', { status: 'active' }],
  ])('update-user cannot set %s', async (_field, body) => {
    const academy = await createTestAcademy();
    const payload = 'academyId' in body ? { academyId: academy.id } : body;
    const signed = await signUp({ name: 'X', email: 'x@example.com', password: 'secret-123' });
    const cookie = signed.headers['set-cookie'];

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/update-user',
      headers: { ...origin, cookie: Array.isArray(cookie) ? cookie.join('; ') : String(cookie) },
      payload,
    });

    expect(res.statusCode).toBe(400);
    const u = await userByEmail('x@example.com');
    expect(u.role).toBe('student');
    expect(u.academyId).toBeNull();
  });
});
