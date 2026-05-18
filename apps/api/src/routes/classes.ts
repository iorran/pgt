import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { bjjClass } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function classRoutes(app: FastifyInstance) {
  // List classes for academy
  app.get('/api/classes', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(bjjClass).where(eq(bjjClass.academyId, academyId));
  });

  // Create class (owner only)
  app.post('/api/classes', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(bjjClass).values({
      academyId: request.academyId,
      instructorId: request.user.id,
      name: body.name,
      type: body.type,
      recurrence: body.recurrence,
      dayOfWeek: body.dayOfWeek,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update class
  app.put('/api/classes/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(bjjClass)
      .set(body)
      .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      .returning();
    return updated;
  });

  // Delete (deactivate) class
  app.delete('/api/classes/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const [updated] = await db.update(bjjClass)
      .set({ active: false })
      .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      .returning();
    return updated;
  });
}
