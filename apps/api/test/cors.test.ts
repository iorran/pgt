import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
});

describe('CORS', () => {
  it('allows credentialed requests from a trusted origin', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow an untrusted origin', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
