import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { competitionResult, season, xpEntry, user } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';

export async function competitionResultRoutes(app: FastifyInstance) {
  // Submit a competition result
  app.post('/api/competition-results', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as any;
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
  app.get('/api/competition-results', async (request) => {
    const { seasonId, status } = request.query as { seasonId: string; status?: string };
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
  app.put('/api/competition-results/:id/approve', { preHandler: [requireOwner] }, async (request) => {
    const { id } = request.params as { id: string };

    // 1. Fetch the result
    const [result] = await db.select().from(competitionResult).where(eq(competitionResult.id, id));
    if (!result) throw new Error('Result not found');

    // 2. Fetch the season to get pointsConfig
    const [seasonData] = await db.select().from(season).where(eq(season.id, result.seasonId));
    if (!seasonData) throw new Error('Season not found');

    // 3. Calculate points from config
    const pointsConfig = seasonData.pointsConfig as Record<number, number>;
    const points = pointsConfig[result.position] || 0;

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
  app.put('/api/competition-results/:id/reject', { preHandler: [requireOwner] }, async (request) => {
    const { id } = request.params as { id: string };
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
