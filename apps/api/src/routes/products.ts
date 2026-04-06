import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { product } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function productRoutes(app: FastifyInstance) {
  // List active products for academy
  app.get('/api/products', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(product).where(and(eq(product.academyId, academyId), eq(product.active, true)));
  });

  // Create product (instructor only)
  app.post('/api/products', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(product).values({
      academyId: request.academyId,
      name: body.name,
      description: body.description,
      price: body.price,
      photoUrl: body.photoUrl,
      stock: body.stock,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update product (instructor only)
  app.put('/api/products/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(product)
      .set(body)
      .where(and(eq(product.id, id), eq(product.academyId, request.academyId)))
      .returning();
    return updated;
  });

  // Soft-delete product (instructor only)
  app.delete('/api/products/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const [updated] = await db.update(product)
      .set({ active: false })
      .where(and(eq(product.id, id), eq(product.academyId, request.academyId)))
      .returning();
    return updated;
  });
}
