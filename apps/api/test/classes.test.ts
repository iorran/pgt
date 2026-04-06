import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, createTestAcademy, createTestUser } from './helpers';
import { db } from '../src/db/client';
import { bjjClass } from '../src/db/schema';

describe('GET /api/classes', () => {
  it('returns classes for the academy', async () => {
    const app = await createTestApp();
    const academy = await createTestAcademy();
    const instructor = await createTestUser(academy.id, { role: 'instructor' });

    await db.insert(bjjClass).values({
      academyId: academy.id,
      instructorId: instructor.id,
      name: 'Gi Manhã',
      type: 'gi',
      recurrence: 'weekly',
      dayOfWeek: 1,
      startTime: '07:00',
      endTime: '08:30',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/classes?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Gi Manhã');
  });
});
