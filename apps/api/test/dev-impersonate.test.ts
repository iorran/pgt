import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createTestApp, cleanDb, testDb, createTestAcademy, createTestUser } from './helpers';
import { session } from '../src/db/schema/index';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let originalNodeEnv: string | undefined;
let originalBypass: string | undefined;

beforeAll(async () => {
  originalNodeEnv = process.env.NODE_ENV;
  originalBypass = process.env.DEV_AUTH_BYPASS;
  app = await createTestApp();
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.DEV_AUTH_BYPASS = originalBypass;
});

beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/dev/impersonate', () => {
  it('returns 404 when NODE_ENV is not development', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = '1';

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=test@example.com',
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when DEV_AUTH_BYPASS is not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_AUTH_BYPASS;

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=test@example.com',
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when email query param is missing', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = '1';

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = '1';

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=nonexistent@example.com',
    });

    expect(res.statusCode).toBe(404);
  });

  it('creates a session and sets the cookie for an existing user', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = '1';

    const acad = await createTestAcademy();
    const user = await createTestUser(acad.id, { email: 'joao@demo.pgt' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=joao@demo.pgt',
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toContain('better-auth.session_token=');
    expect(cookieStr).toContain('HttpOnly');

    const sessions = await testDb
      .select()
      .from(session)
      .where(eq(session.userId, user.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token).toBeDefined();
    expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('deletes prior sessions before creating a new one', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = '1';

    const acad = await createTestAcademy();
    const user = await createTestUser(acad.id, { email: 'joao@demo.pgt' });

    // Call impersonate twice
    await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=joao@demo.pgt',
    });
    await app.inject({
      method: 'GET',
      url: '/api/dev/impersonate?email=joao@demo.pgt',
    });

    // Should still have exactly one session
    const sessions = await testDb
      .select()
      .from(session)
      .where(eq(session.userId, user.id));
    expect(sessions).toHaveLength(1);
  });
});
