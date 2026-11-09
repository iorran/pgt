import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, authHeaders } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });
afterEach(() => { vi.restoreAllMocks(); });

async function post(payload: object, withAuth = true) {
  const academy = await createTestAcademy();
  const student = await createTestUser(academy.id, { name: 'Ana Secret' });
  const res = await app.inject({
    method: 'POST',
    url: '/api/help/events',
    headers: withAuth ? authHeaders(student) : {},
    payload,
  });
  return { res, academy, student };
}

describe('POST /api/help/events', () => {
  it('401 when unauthenticated', async () => {
    const { res } = await post({ type: 'search_miss', guide: 'student', value: 'pix' }, false);
    expect(res.statusCode).toBe(401);
  });

  it('400 on invalid body', async () => {
    const bad = [
      {},
      { type: 'click', guide: 'student', value: 'x' },
      { type: 'search_miss', guide: 'admin', value: 'pix' },
      { type: 'search_miss', guide: 'student', value: 1 },
      { type: 'search_miss', guide: 'student', value: ' ' },
      { type: 'section_open', guide: 'owner', value: 'a'.repeat(201) },
    ];
    for (const payload of bad) {
      expect((await post(payload)).res.statusCode).toBe(400);
    }
  });

  it('204 and logs one JSON line without user identity', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { res, academy } = await post({ type: 'section_open', guide: 'student', value: ' Conta da Família ' });
    expect(res.statusCode).toBe(204);
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('help_event'));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      event: 'help_event',
      academyId: academy.id,
      role: 'student',
      type: 'section_open',
      guide: 'student',
      value: 'Conta da Família',
      ts: expect.any(String),
    });
    expect(lines[0]).not.toContain('Ana Secret');
  });
});
