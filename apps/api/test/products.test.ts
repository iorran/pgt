import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestInstructor, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

describe('GET /api/products', () => {
  it('lists active products for an academy', async () => {
    const academy = await createTestAcademy();
    await testDb.insert(schema.product).values([
      { academyId: academy.id, name: 'Gi White', price: '350.00', stock: 10 },
      { academyId: academy.id, name: 'Rashguard', price: '120.00', stock: 20 },
      { academyId: academy.id, name: 'Old Item', price: '50.00', stock: 0, active: false },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/products?academyId=${academy.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.map((p: any) => p.name).sort()).toEqual(['Gi White', 'Rashguard']);
  });

  it('returns empty array when no products exist', async () => {
    const academy = await createTestAcademy();
    const res = await app.inject({
      method: 'GET',
      url: `/api/products?academyId=${academy.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('POST /api/products', () => {
  it('instructor creates a product', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeaders(instructor),
      payload: {
        name: 'Academy T-Shirt',
        description: 'Official t-shirt',
        price: '80.00',
        stock: 50,
        photoUrl: 'https://example.com/photo.jpg',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Academy T-Shirt');
    expect(body.price).toBe('80.00');
    expect(body.stock).toBe(50);
    expect(body.active).toBe(true);
    expect(body.academyId).toBe(academy.id);
  });

  it('student cannot create a product', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: authHeaders(student),
      payload: { name: 'Hack', price: '0.00', stock: 1 },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/products/:id', () => {
  it('instructor updates a product', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Belt', price: '60.00', stock: 5,
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${prod.id}`,
      headers: authHeaders(instructor),
      payload: { name: 'Blue Belt', price: '70.00', stock: 10 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Blue Belt');
    expect(body.price).toBe('70.00');
    expect(body.stock).toBe(10);
  });

  it('instructor cannot update product from another academy', async () => {
    const academy1 = await createTestAcademy({ slug: 'a1', joinCode: 'A1' });
    const academy2 = await createTestAcademy({ slug: 'a2', joinCode: 'A2' });
    const instructor = await createTestInstructor(academy1.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy2.id, name: 'Other Product', price: '100.00', stock: 5,
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${prod.id}`,
      headers: authHeaders(instructor),
      payload: { name: 'Hijacked' },
    });

    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/products/:id', () => {
  it('soft-deletes a product (sets active=false)', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestInstructor(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'To Remove', price: '30.00', stock: 2,
    }).returning();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/products/${prod.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);

    // Verify it no longer shows in active list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/products?academyId=${academy.id}`,
    });
    expect(listRes.json()).toHaveLength(0);
  });
});
