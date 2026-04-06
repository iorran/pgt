import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { membershipPlan } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function membershipPlanRoutes(app: FastifyInstance) {
  // List active plans for an academy
  app.get('/api/membership-plans', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(membershipPlan).where(
      and(eq(membershipPlan.academyId, academyId), eq(membershipPlan.active, true))
    );
  });

  // Create plan (instructor only)
  app.post('/api/membership-plans', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(membershipPlan).values({
      academyId: request.academyId,
      name: body.name,
      price: body.price,
      frequency: body.frequency,
      classesPerWeek: body.classesPerWeek,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update plan (instructor only)
  app.put('/api/membership-plans/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(membershipPlan)
      .set(body)
      .where(and(eq(membershipPlan.id, id), eq(membershipPlan.academyId, request.academyId)))
      .returning();
    return updated;
  });

  // Soft-delete plan (instructor only)
  app.delete('/api/membership-plans/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const [updated] = await db.update(membershipPlan)
      .set({ active: false })
      .where(and(eq(membershipPlan.id, id), eq(membershipPlan.academyId, request.academyId)))
      .returning();
    return updated;
  });
}
