import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { createTestApp, cleanDb, createTestAcademy, createTestUser, createTestOwner, authHeaders, testDb } from './helpers';
import * as schema from '../src/db/schema/index';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });

describe('POST /api/orders', () => {
  it('student places an order', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'Buyer' });
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Gi Blue', price: '400.00', stock: 5,
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeaders(student),
      payload: { productId: prod.id, studentId: student.id, quantity: 2 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.productId).toBe(prod.id);
    expect(body.studentId).toBe(student.id);
    expect(body.quantity).toBe(2);
    expect(body.status).toBe('requested');
  });

  it('instructor can also place an order', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Rashguard', price: '120.00', stock: 10,
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: authHeaders(instructor),
      payload: { productId: prod.id, studentId: instructor.id, quantity: 1 },
    });

    expect(res.statusCode).toBe(201);
  });
});

describe('GET /api/orders', () => {
  it('instructor lists all orders for academy', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id, { name: 'OrderStudent' });
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Belt', price: '60.00', stock: 20,
    }).returning();

    await testDb.insert(schema.order).values([
      { productId: prod.id, studentId: student.id, quantity: 1 },
      { productId: prod.id, studentId: student.id, quantity: 3 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders?academyId=${academy.id}`,
      headers: authHeaders(instructor),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].productName).toBe('Belt');
    expect(body[0].studentName).toBe('OrderStudent');
  });

  it('student cannot list all orders (requires instructor)', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders?academyId=${academy.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/orders/student/:studentId', () => {
  it('returns orders for a specific student', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id, { name: 'MyOrders' });
    const [prod1] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Item A', price: '50.00', stock: 10,
    }).returning();
    const [prod2] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Item B', price: '75.00', stock: 5,
    }).returning();

    await testDb.insert(schema.order).values([
      { productId: prod1.id, studentId: student.id, quantity: 1 },
      { productId: prod2.id, studentId: student.id, quantity: 2 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/student/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.map((o: any) => o.productName).sort()).toEqual(['Item A', 'Item B']);
  });

  it('returns empty array for student with no orders', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/student/${student.id}`,
      headers: authHeaders(student),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });
});

describe('PUT /api/orders/:id/status', () => {
  it('instructor updates order status to confirmed', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Gi', price: '300.00', stock: 3,
    }).returning();
    const [ord] = await testDb.insert(schema.order).values({
      productId: prod.id, studentId: student.id, quantity: 1,
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/orders/${ord.id}/status`,
      headers: authHeaders(instructor),
      payload: { status: 'confirmed' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('confirmed');
  });

  it('instructor updates order status to delivered', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Gi', price: '300.00', stock: 3,
    }).returning();
    const [ord] = await testDb.insert(schema.order).values({
      productId: prod.id, studentId: student.id, quantity: 1, status: 'confirmed',
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/orders/${ord.id}/status`,
      headers: authHeaders(instructor),
      payload: { status: 'delivered' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('delivered');
  });

  it('instructor cancels an order', async () => {
    const academy = await createTestAcademy();
    const instructor = await createTestOwner(academy.id);
    const student = await createTestUser(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Gi', price: '300.00', stock: 3,
    }).returning();
    const [ord] = await testDb.insert(schema.order).values({
      productId: prod.id, studentId: student.id, quantity: 1,
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/orders/${ord.id}/status`,
      headers: authHeaders(instructor),
      payload: { status: 'cancelled' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('cancelled');
  });

  it('student cannot update order status', async () => {
    const academy = await createTestAcademy();
    const student = await createTestUser(academy.id);
    const [prod] = await testDb.insert(schema.product).values({
      academyId: academy.id, name: 'Gi', price: '300.00', stock: 3,
    }).returning();
    const [ord] = await testDb.insert(schema.order).values({
      productId: prod.id, studentId: student.id, quantity: 1,
    }).returning();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/orders/${ord.id}/status`,
      headers: authHeaders(student),
      payload: { status: 'confirmed' },
    });

    expect(res.statusCode).toBe(403);
  });
});
