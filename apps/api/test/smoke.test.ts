import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestApp,
  cleanDb,
  createTestAcademy,
  createTestOwner,
  authHeaders,
} from './helpers';

describe('Test infrastructure', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('health check works', async () => {
    const app = await createTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('can create test data and make authenticated requests', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/classes?academyId=${academy.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
