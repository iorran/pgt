import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { season, competitionResult, user, modality, studentModality } from '../db/schema/index.js';
import { eq, and, sql, inArray, isNotNull, desc } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { normalizePointsConfig, pointsForPosition, withRanks } from '../gamification/points.js';
import { saveResult } from '../gamification/result-points.js';
import { rankingCategory } from '../gamification/ranking-category.js';
import { UUID } from './families.js';

export async function seasonRoutes(app: FastifyInstance) {
  // List seasons for academy
  app.get('/api/seasons', { preHandler: [requireAuth, injectAcademyId] }, async (request) => {
    // Newest first: pages default to the first season when none is active today.
    return db.select().from(season).where(eq(season.academyId, request.academyId)).orderBy(desc(season.startDate));
  });

  // Get single season
  app.get('/api/seasons/:id', { preHandler: [requireAuth, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [found] = await db.select().from(season)
      .where(and(eq(season.id, id), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    return found;
  });

  // Create season (owner only)
  app.post('/api/seasons', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(season).values({
      academyId: request.academyId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      pointsConfig: normalizePointsConfig(body.pointsConfig),
      prizeDescription: body.prizeDescription,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update season (owner only)
  app.put('/api/seasons/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    // id, academyId and active are not editable here.
    const editable = ['name', 'startDate', 'endDate', 'pointsConfig', 'prizeDescription'];
    const changes = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
    if (Object.keys(changes).length === 0) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }
    if (changes.pointsConfig !== undefined) {
      changes.pointsConfig = normalizePointsConfig(changes.pointsConfig as Record<string, unknown>);
    }
    const [updated] = UUID.test(id)
      ? await db.update(season)
          .set(changes)
          .where(and(eq(season.id, id), eq(season.academyId, request.academyId)))
          .returning()
      : [];
    if (!updated) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    return updated;
  });

  // Re-apply the season's points to approved podium results whose points were not typed (owner only)
  app.post('/api/seasons/:id/recalculate', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [found] = await db.select({ pointsConfig: season.pointsConfig }).from(season)
      .where(and(eq(season.id, id), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }
    const rows = await db.select({ id: competitionResult.id, position: competitionResult.position })
      .from(competitionResult)
      .where(and(
        eq(competitionResult.seasonId, id),
        eq(competitionResult.status, 'approved'),
        isNotNull(competitionResult.position),
        eq(competitionResult.pointsOverridden, false),
      ));
    for (const row of rows) {
      await saveResult(row.id, { pointsAwarded: pointsForPosition(found.pointsConfig as Record<string, unknown>, row.position) });
    }
    return { updated: rows.length };
  });

  // Leaderboard for a season
  app.get('/api/seasons/:id/leaderboard', { preHandler: [requireAuth, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { category, belt } = request.query as { category?: string; belt?: string };

    const [found] = await db.select({ id: season.id }).from(season)
      .where(and(eq(season.id, id), eq(season.academyId, request.academyId)));
    if (!found) {
      return reply.status(404).send({ error: 'Season not found' });
    }

    const results = await db.select({
      studentId: user.id,
      studentName: user.name,
      belt: user.belt,
      dateOfBirth: user.dateOfBirth,
      totalPoints: sql<number>`COALESCE(SUM(${competitionResult.pointsAwarded}), 0)`.as('total_points'),
    })
    .from(competitionResult)
    .innerJoin(user, eq(user.id, competitionResult.studentId))
    .where(and(
      eq(competitionResult.seasonId, id),
      eq(competitionResult.status, 'approved'),
    ))
    .groupBy(user.id, user.name, user.belt, user.dateOfBirth)
    // Ties sorted by name so the order is stable between refreshes.
    .orderBy(sql`total_points DESC`, user.name);

    // Kids vs Adultos follows the Ranking Category rule (belt, birth date, Kids modality).
    const modalityRows = results.length
      ? await db.select({ studentId: studentModality.studentId, name: modality.name })
        .from(studentModality)
        .innerJoin(modality, eq(modality.id, studentModality.modalityId))
        .where(inArray(studentModality.studentId, results.map((r) => r.studentId)))
      : [];
    const filtered = results.filter((r) => {
      const modalities = modalityRows.filter((m) => m.studentId === r.studentId).map((m) => m.name);
      const isKid = rankingCategory({ belt: r.belt, dateOfBirth: r.dateOfBirth, modalities }) === 'kids';
      if (category === 'kids') {
        return isKid;
      }
      if (category === 'adults') {
        return !isKid && (!belt || r.belt === belt);
      }
      return true;
    });
    // dateOfBirth is only for the category filter: never sent to other members.
    return withRanks(filtered.map(({ dateOfBirth: _dob, ...r }) => ({ ...r, totalPoints: Number(r.totalPoints) })));
  });
}
