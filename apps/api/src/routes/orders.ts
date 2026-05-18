import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { order, product, user } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function orderRoutes(app: FastifyInstance) {
  // Student places an order request
  app.post('/api/orders', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(order).values({
      productId: body.productId,
      studentId: body.studentId,
      quantity: body.quantity,
    }).returning();
    return reply.status(201).send(created);
  });

  // List all orders for academy (owner only)
  app.get('/api/orders', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db
      .select({
        id: order.id,
        productId: order.productId,
        studentId: order.studentId,
        quantity: order.quantity,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        productName: product.name,
        studentName: user.name,
      })
      .from(order)
      .innerJoin(product, eq(order.productId, product.id))
      .innerJoin(user, eq(order.studentId, user.id))
      .where(eq(product.academyId, academyId));
  });

  // Student's own orders
  app.get('/api/orders/student/:studentId', { preHandler: [requireAuth] }, async (request) => {
    const { studentId } = request.params as { studentId: string };
    return db
      .select({
        id: order.id,
        productId: order.productId,
        studentId: order.studentId,
        quantity: order.quantity,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        productName: product.name,
      })
      .from(order)
      .innerJoin(product, eq(order.productId, product.id))
      .where(eq(order.studentId, studentId));
  });

  // Update order status (owner only)
  app.put('/api/orders/:id/status', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: string };
    const [updated] = await db.update(order)
      .set({ status: body.status as any, updatedAt: new Date() })
      .where(eq(order.id, id))
      .returning();
    return updated;
  });
}
