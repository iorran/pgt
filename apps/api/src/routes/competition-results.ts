import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { competitionResult, season, xpEntry, user } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { canActForStudent } from '../middleware/student-access.js';
import { pointsForPosition } from '../gamification/points.js';

// A competition result belongs to the academy of its season.
async function findAcademyResult(id: string, academyId: string) {
  const [row] = await db.select({ result: competitionResult, pointsConfig: season.pointsConfig })
    .from(competitionResult)
    .innerJoin(season, eq(season.id, competitionResult.seasonId))
    .where(and(eq(competitionResult.id, id), eq(season.academyId, academyId)));
  return row;
}

export async function competitionResultRoutes(app: FastifyInstance) {
  // Submit a competition result
  app.post('/api/competition-results', { preHandler: [requireAuth, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    if (!(await canActForStudent(request, reply, body.studentId))) {
      return reply;
    }
    const [found] = await db.select({ id: season.id }).from(season)
      .where(and(eq(season.id, body.seasonId), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    const [created] = await db.insert(competitionResult).values({
      seasonId: body.seasonId,
      studentId: body.studentId,
      competitionName: body.competitionName,
      competitionDate: body.competitionDate,
      position: body.position,
      submittedBy: request.user.id,
      status: 'pending',
      pointsAwarded: 0,
    }).returning();
    return reply.status(201).send(created);
  });

  // List competition results with optional status filter (includes studentName via join)
  app.get('/api/competition-results', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { seasonId, status } = request.query as { seasonId: string; status?: string };
    const [found] = await db.select({ id: season.id }).from(season)
      .where(and(eq(season.id, seasonId), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    const conditions = [eq(competitionResult.seasonId, seasonId)];
    if (status) {
      conditions.push(eq(competitionResult.status, status as 'pending' | 'approved' | 'rejected'));
    }
    const rows = await db
      .select({
        id: competitionResult.id,
        seasonId: competitionResult.seasonId,
        studentId: competitionResult.studentId,
        competitionName: competitionResult.competitionName,
        date: competitionResult.competitionDate,
        position: competitionResult.position,
        pointsAwarded: competitionResult.pointsAwarded,
        status: competitionResult.status,
        submittedBy: competitionResult.submittedBy,
        reviewedBy: competitionResult.reviewedBy,
        createdAt: competitionResult.createdAt,
        studentName: user.name,
      })
      .from(competitionResult)
      .leftJoin(user, eq(competitionResult.studentId, user.id))
      .where(and(...conditions));
    return rows;
  });

  // Approve a competition result (owner only)
  app.put('/api/competition-results/:id/approve', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // 1-2. Fetch the result (scoped to the academy) with its season's pointsConfig
    const found = await findAcademyResult(id, request.academyId);
    if (!found) {
      return reply.status(404).send({ error: 'Result not found' });
    }
    const { result } = found;

    // 3. Calculate points from config
    const points = pointsForPosition(found.pointsConfig as Record<string, unknown>, result.position);

    // 4. Update result: approved + points
    const [updated] = await db.update(competitionResult)
      .set({
        status: 'approved',
        pointsAwarded: points,
        reviewedBy: request.user.id,
      })
      .where(eq(competitionResult.id, id))
      .returning();

    // 5. Create XP entry
    await db.insert(xpEntry).values({
      studentId: result.studentId,
      xpAmount: points * 10,
      sourceType: 'competition',
      sourceId: result.id,
    });

    return updated;
  });

  // Reject a competition result (owner only)
  app.put('/api/competition-results/:id/reject', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await findAcademyResult(id, request.academyId))) {
      return reply.status(404).send({ error: 'Result not found' });
    }
    const [updated] = await db.update(competitionResult)
      .set({
        status: 'rejected',
        reviewedBy: request.user.id,
      })
      .where(eq(competitionResult.id, id))
      .returning();
    return updated;
  });
}
