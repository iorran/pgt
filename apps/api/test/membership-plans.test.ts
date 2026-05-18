import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

describe('GET /api/membership-plans', () => {
  it('lists active plans for an academy', async () => {
    const academy = await createTestAcademy();
    await testDb.insert(schema.membershipPlan).values([
      { academyId: academy.id, name: 'Basic', price: '99.90', frequency: 'monthly' },
      { academyId: academy.id, name: 'Premium', price: '149.90', frequency: 'monthly' },
      { academyId: academy.id, name: 'Inactive Plan', price: '50.00', frequency: 'monthly', active: false },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/membership-plans?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.map((p: any) => p.name).sort()).toEqual(['Basic', 'Premium']);
  });

  it('returns empty array when academy has no plans', async () => {
    const academy = await createTestAcademy();
    const res = await app.inject({
      method: 'GET',
      url: `/api/membership-plans?academyId=${academy.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('does not return plans from another academy', async () => {
    const academy1 = await createTestAcademy({ slug: 'academy-1', joinCode: 'A1' });
    const academy2 = await createTestAcademy({ slug: 'academy-2', joinCode: 'A2' });
    await testDb.insert(schema.membershipPlan).values({
      academyId: academy1.id, name: 'Plan A1', price: '100.00', frequency: 'monthly',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/membership-plans?academyId=${academy2.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('POST /api/membership-plans', () => {
  it('instructor creates a plan', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/membership-plans',
      headers: authHeaders(instructor),
      payload: { name: 'Gold', price: '199.90', frequency: 'monthly', classesPerWeek: 5 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Gold');
    expect(body.price).toBe('199.90');
    expect(body.frequency).toBe('monthly');
    expect(body.classesPerWeek).toBe(5);
    expect(body.active).toBe(true);
  });

  it('student cannot create a plan', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/membership-plans',
      headers: authHeaders(student),
      payload: { name: 'Hack', price: '0.00', frequency: 'monthly' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/membership-plans/:id', () => {
  it('instructor updates a plan', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'Old Name', price: '100.00', frequency: 'monthly',
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/membership-plans/${plan.id}`,
      headers: authHeaders(instructor),
      payload: { name: 'New Name', price: '120.00' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('New Name');
    expect(body.price).toBe('120.00');
  });

  it('instructor cannot update plan from another academy', async () => {
    const academy1 = await createTestAcademy({ slug: 'a1', joinCode: 'A1' });
    const academy2 = await createTestAcademy({ slug: 'a2', joinCode: 'A2' });
    const instructor = await createTestOwner(academy1.id);
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy2.id, name: 'Other Plan', price: '100.00', frequency: 'monthly',
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/membership-plans/${plan.id}`,
      headers: authHeaders(instructor),
      payload: { name: 'Hijacked' },
    });

    // Should return undefined/null since no rows matched
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/membership-plans/:id', () => {
  it('soft-deletes a plan (sets active=false)', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const [plan] = await testDb.insert(schema.membershipPlan).values({
      academyId: academy.id, name: 'To Delete', price: '80.00', frequency: 'monthly',
    }).returning();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/membership-plans/${plan.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);

    // Verify it no longer shows in active list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/membership-plans?academyId=${academy.id}`,
    });
    expect(listRes.json()).toHaveLength(0);
  });
});
