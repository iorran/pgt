import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { season, competitionResult, user } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { normalizePointsConfig, withRanks } from '../gamification/points.js';

export async function seasonRoutes(app: FastifyInstance) {
  // List seasons for academy
  app.get('/api/seasons', { preHandler: [requireAuth, injectAcademyId] }, async (request) => {
    return db.select().from(season).where(eq(season.academyId, request.academyId));
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
  app.put('/api/seasons/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    if (body.pointsConfig !== undefined) {
      body.pointsConfig = normalizePointsConfig(body.pointsConfig);
    }
    const [updated] = await db.update(season)
      .set({ ...body, id, academyId: request.academyId })
      .where(and(eq(season.id, id), eq(season.academyId, request.academyId)))
      .returning();
    return updated;
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

    const KID_AGE_LIMIT = 16;
    const today = new Date();

    const filtered = results.filter(r => {
      if (!r.dateOfBirth) return category !== 'kids';
      const age = Math.floor((today.getTime() - new Date(r.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const isKid = age < KID_AGE_LIMIT;
      if (category === 'kids') return isKid;
      if (category === 'adults' && belt) return !isKid && r.belt === belt;
      if (category === 'adults') return !isKid;
      return true;
    });
    return withRanks(filtered.map((r) => ({ ...r, totalPoints: Number(r.totalPoints) })));
  });
}
