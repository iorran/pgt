import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { tournament, tournamentSignup, user } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

export async function tournamentRoutes(app: FastifyInstance) {
  // List tournaments for academy
  app.get('/api/tournaments', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(tournament).where(eq(tournament.academyId, academyId));
  });

  // Create tournament (instructor only)
  app.post('/api/tournaments', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(tournament).values({
      academyId: request.academyId,
      name: body.name,
      date: body.date,
      location: body.location,
      federation: body.federation,
    }).returning();
    return reply.status(201).send(created);
  });

  // Student signs up for a tournament
  app.post('/api/tournaments/:id/signup', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const [created] = await db.insert(tournamentSignup).values({
      tournamentId: id,
      studentId: body.studentId,
      weightClass: body.weightClass,
    }).returning();
    return reply.status(201).send(created);
  });

  // View signed-up students (roster)
  app.get('/api/tournaments/:id/roster', async (request) => {
    const { id } = request.params as { id: string };
    return db
      .select({
        signupId: tournamentSignup.id,
        studentId: tournamentSignup.studentId,
        weightClass: tournamentSignup.weightClass,
        studentName: user.name,
        belt: user.belt,
      })
      .from(tournamentSignup)
      .innerJoin(user, eq(tournamentSignup.studentId, user.id))
      .where(eq(tournamentSignup.tournamentId, id));
  });
}
