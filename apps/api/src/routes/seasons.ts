import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { season } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function seasonRoutes(app: FastifyInstance) {
  // List seasons for academy
  app.get('/api/seasons', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(season).where(eq(season.academyId, academyId));
  });

  // Get single season
  app.get('/api/seasons/:id', async (request) => {
    const { id } = request.params as { id: string };
    const [found] = await db.select().from(season).where(eq(season.id, id));
    return found;
  });

  // Create season (instructor only)
  app.post('/api/seasons', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(season).values({
      academyId: request.academyId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      pointsConfig: body.pointsConfig,
      prizeDescription: body.prizeDescription,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update season (instructor only)
  app.put('/api/seasons/:id', { preHandler: [requireInstructor, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [updated] = await db.update(season)
      .set(body)
      .where(and(eq(season.id, id), eq(season.academyId, request.academyId)))
      .returning();
    return updated;
  });
}
