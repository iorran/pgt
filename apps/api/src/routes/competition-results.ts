import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { academy, competitionResult, season, xpEntry, user } from '../db/schema/index.js';
import { eq, and, lte, gte, desc } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { canActForStudent } from '../middleware/student-access.js';
import { pointsForPosition } from '../gamification/points.js';
import { saveResult } from '../gamification/result-points.js';
import { DEFAULT_ACADEMY_TIMEZONE, isoDateInTz } from '../utils/timezone.js';

// A competition result belongs to the academy of its season.
async function findAcademyResult(id: string, academyId: string) {
  const [row] = await db.select({ result: competitionResult, pointsConfig: season.pointsConfig })
    .from(competitionResult)
    .innerJoin(season, eq(season.id, competitionResult.seasonId))
    .where(and(eq(competitionResult.id, id), eq(season.academyId, academyId)));
  return row;
}

// Approving awards the season's points for the podium position (typed points are kept).
function approveResult(result: typeof competitionResult.$inferSelect, pointsConfig: unknown, reviewerId: string) {
  return saveResult(result.id, {
    status: 'approved',
    reviewedBy: reviewerId,
    ...(result.pointsOverridden ? {} : { pointsAwarded: pointsForPosition(pointsConfig as Record<string, unknown>, result.position) }),
  });
}

const STATUSES = ['pending', 'approved', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

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

  // List a season's results, optionally by status and student, newest competition first (includes studentName via join)
  app.get('/api/competition-results', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { seasonId, status, studentId } = request.query as { seasonId: string; status?: string; studentId?: string };
    const [found] = await db.select({ id: season.id }).from(season)
      .where(and(eq(season.id, seasonId), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    const conditions = [eq(competitionResult.seasonId, seasonId)];
    if (status) {
      conditions.push(eq(competitionResult.status, status as Status));
    }
    if (studentId) {
      conditions.push(eq(competitionResult.studentId, studentId));
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
        pointsOverridden: competitionResult.pointsOverridden,
        status: competitionResult.status,
        submittedBy: competitionResult.submittedBy,
        reviewedBy: competitionResult.reviewedBy,
        createdAt: competitionResult.createdAt,
        studentName: user.name,
      })
      .from(competitionResult)
      .leftJoin(user, eq(competitionResult.studentId, user.id))
      .where(and(...conditions))
      .orderBy(desc(competitionResult.competitionDate), desc(competitionResult.createdAt));
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
    return saveResult(id, { status: 'rejected', reviewedBy: request.user.id });
  });

  // Edit a result (owner only). Typed points are kept; otherwise they follow the season (decision 2).
  app.patch('/api/competition-results/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      competitionName?: string; competitionDate?: string; position?: number | null; status?: string; pointsAwarded?: number;
    };
    if (body.position !== undefined && body.position !== null && !(Number.isInteger(body.position) && body.position >= 1 && body.position <= 3)) {
      return reply.status(400).send({ error: 'Only podium positions (1–3) count' });
    }
    if (body.status !== undefined && !STATUSES.includes(body.status as Status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }
    if (body.pointsAwarded !== undefined && !Number.isInteger(body.pointsAwarded)) {
      return reply.status(400).send({ error: 'Points must be a whole number' });
    }
    if (body.competitionName !== undefined && !body.competitionName.trim()) {
      return reply.status(400).send({ error: 'Competition name is required' });
    }
    const found = await findAcademyResult(id, request.academyId);
    if (!found) {
      return reply.status(404).send({ error: 'Result not found' });
    }
    const { result } = found;
    const changes: Parameters<typeof saveResult>[1] = {};
    if (body.competitionName !== undefined) {
      changes.competitionName = body.competitionName.trim();
    }
    if (body.competitionDate !== undefined) {
      changes.competitionDate = body.competitionDate;
    }
    if (body.position !== undefined) {
      changes.position = body.position;
    }
    if (body.status !== undefined) {
      changes.status = body.status as Status;
      changes.reviewedBy = request.user.id;
    }
    if (body.pointsAwarded !== undefined) {
      changes.pointsAwarded = body.pointsAwarded;
      changes.pointsOverridden = true;
    } else if ((body.position !== undefined || body.status !== undefined) && !result.pointsOverridden) {
      changes.pointsAwarded = pointsForPosition(found.pointsConfig as Record<string, unknown>, body.position !== undefined ? body.position : result.position);
    }
    if (Object.keys(changes).length === 0) {
      return result;
    }
    return saveResult(id, changes);
  });

  // Delete a result and its XP (owner only)
  app.delete('/api/competition-results/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await findAcademyResult(id, request.academyId))) {
      return reply.status(404).send({ error: 'Result not found' });
    }
    await db.transaction(async (tx) => {
      await tx.delete(xpEntry).where(and(eq(xpEntry.sourceType, 'competition'), eq(xpEntry.sourceId, id)));
      await tx.delete(competitionResult).where(eq(competitionResult.id, id));
    });
    return reply.status(204).send();
  });

  // Point Adjustment (docs/CONTEXT.md): ±N points with a reason, an approved entry with no podium position.
  app.post('/api/competition-results/adjustments', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const body = request.body as { studentId?: string; points?: number; reason?: string; seasonId?: string; date?: string };
    if (!Number.isInteger(body.points) || body.points === 0) {
      return reply.status(400).send({ error: 'Points must be a whole number other than 0' });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return reply.status(400).send({ error: 'Reason is required' });
    }
    if (!(await canActForStudent(request, reply, body.studentId))) {
      return reply;
    }
    let date = body.date;
    if (!date) {
      const [acad] = await db.select({ timezone: academy.timezone }).from(academy).where(eq(academy.id, request.academyId));
      date = isoDateInTz(new Date(), acad?.timezone ?? DEFAULT_ACADEMY_TIMEZONE);
    }
    let found: { id: string } | undefined;
    if (body.seasonId) {
      [found] = await db.select({ id: season.id }).from(season)
        .where(and(eq(season.id, body.seasonId), eq(season.academyId, request.academyId)));
      if (!found) {
        return reply.status(404).send({ error: 'Season not found' });
      }
    } else {
      found = await seasonForDate(request.academyId, date);
      if (!found) {
        return reply.status(422).send({ error: 'NO_SEASON_FOR_DATE' });
      }
    }
    const seasonId = found.id;
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(competitionResult).values({
        seasonId,
        studentId: body.studentId as string,
        competitionName: reason,
        competitionDate: date,
        position: null,
        status: 'approved',
        pointsOverridden: true,
        submittedBy: request.user.id,
        reviewedBy: request.user.id,
      }).returning({ id: competitionResult.id });
      return saveResult(row.id, { pointsAwarded: body.points }, tx);
    });
    return reply.status(201).send(created);
  });
}
