import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { competitionResult, season, xpEntry, user } from '../db/schema/index.js';
import { eq, and, lte, gte, desc } from 'drizzle-orm';
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

// Approving awards the season's points for the podium position plus XP (points × 10).
async function approveResult(result: typeof competitionResult.$inferSelect, pointsConfig: unknown, reviewerId: string) {
  const points = pointsForPosition(pointsConfig as Record<string, unknown>, result.position);
  const [updated] = await db.update(competitionResult)
    .set({ status: 'approved', pointsAwarded: points, reviewedBy: reviewerId })
    .where(eq(competitionResult.id, result.id))
    .returning();
  await db.insert(xpEntry).values({
    studentId: result.studentId,
    xpAmount: points * 10,
    sourceType: 'competition',
    sourceId: result.id,
  });
  return updated;
}

// The season a competition counts for: the one whose range contains its date (latest start wins).
async function seasonForDate(academyId: string, date: string) {
  const [found] = await db.select({ id: season.id, pointsConfig: season.pointsConfig }).from(season)
    .where(and(eq(season.academyId, academyId), lte(season.startDate, date), gte(season.endDate, date)))
    .orderBy(desc(season.startDate))
    .limit(1);
  return found;
}

export async function competitionResultRoutes(app: FastifyInstance) {
  // The logged-in student's own results, newest competition first
  app.get('/api/competition-results/mine', { preHandler: [requireAuth, injectAcademyId] }, async (request) => {
    return db
      .select({
        id: competitionResult.id,
        competitionName: competitionResult.competitionName,
        competitionDate: competitionResult.competitionDate,
        position: competitionResult.position,
        status: competitionResult.status,
        pointsAwarded: competitionResult.pointsAwarded,
        seasonName: season.name,
      })
      .from(competitionResult)
      .innerJoin(season, eq(season.id, competitionResult.seasonId))
      .where(and(eq(competitionResult.studentId, request.user.id), eq(season.academyId, request.academyId)))
      .orderBy(desc(competitionResult.competitionDate));
  });

  // Submit a competition result
  app.post('/api/competition-results', { preHandler: [requireAuth, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    if (!(await canActForStudent(request, reply, body.studentId))) {
      return reply;
    }
    const position = Number(body.position);
    if (!Number.isInteger(position) || position < 1 || position > 3) {
      return reply.status(400).send({ error: 'Only podium positions (1–3) count' });
    }
    let found: { id: string; pointsConfig: unknown } | undefined;
    if (body.seasonId) {
      [found] = await db.select({ id: season.id, pointsConfig: season.pointsConfig }).from(season)
        .where(and(eq(season.id, body.seasonId), eq(season.academyId, request.academyId)));
      if (!found) {
        return reply.status(404).send({ error: 'Season not found' });
      }
    } else {
      found = await seasonForDate(request.academyId, body.competitionDate);
      if (!found) {
        return reply.status(422).send({ error: 'NO_SEASON_FOR_DATE' });
      }
    }
    const [created] = await db.insert(competitionResult).values({
      seasonId: found.id,
      studentId: body.studentId,
      competitionName: body.competitionName,
      competitionDate: body.competitionDate,
      position,
      submittedBy: request.user.id,
      status: 'pending',
      pointsAwarded: 0,
    }).returning();
    // The owner is the approver, so a result he registers is approved right away.
    if (request.user.role === 'owner') {
      return reply.status(201).send(await approveResult(created, found.pointsConfig, request.user.id));
    }
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

    return approveResult(result, found.pointsConfig, request.user.id);
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
