import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { streak, xpEntry, badgeDefinition, studentBadge } from '../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { authorizeStudentRead } from '../middleware/student-access.js';

export async function gamificationRoutes(app: FastifyInstance) {
  // Get gamification profile for a student
  app.get('/api/gamification/profile/:studentId', { preHandler: authorizeStudentRead('studentId') }, async (request) => {
    const { studentId } = request.params as { studentId: string };

    const [studentStreak] = await db.select().from(streak).where(eq(streak.studentId, studentId));

    const [xpTotal] = await db.select({
      total: sql<number>`COALESCE(SUM(${xpEntry.xpAmount}), 0)`,
    }).from(xpEntry).where(eq(xpEntry.studentId, studentId));

    const badges = await db.select({
      name: badgeDefinition.name,
      description: badgeDefinition.description,
      icon: badgeDefinition.icon,
      earnedAt: studentBadge.earnedAt,
    })
    .from(studentBadge)
    .innerJoin(badgeDefinition, eq(badgeDefinition.id, studentBadge.badgeDefinitionId))
    .where(eq(studentBadge.studentId, studentId));

    return {
      xp: xpTotal.total,
      streak: studentStreak || { currentStreak: 0, longestStreak: 0 },
      badges,
    };
  });

  // List badge definitions for an academy
  app.get('/api/gamification/badges', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(badgeDefinition).where(eq(badgeDefinition.academyId, academyId));
  });

  // Create badge definition (instructor only)
  app.post('/api/gamification/badges', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as any;
    const [created] = await db.insert(badgeDefinition).values({
      academyId: request.academyId,
      name: body.name,
      description: body.description,
      icon: body.icon,
      criteriaType: body.criteriaType,
      criteriaValue: body.criteriaValue,
    }).returning();
    return reply.status(201).send(created);
  });

  // Manually award a badge to a student (instructor only)
  app.post('/api/gamification/badges/:badgeId/award/:studentId', { preHandler: [requireInstructor] }, async (request, reply) => {
    const { badgeId, studentId } = request.params as { badgeId: string; studentId: string };

    // Insert student badge
    const [awarded] = await db.insert(studentBadge).values({
      studentId,
      badgeDefinitionId: badgeId,
    }).returning();

    // Create XP entry for badge award
    const [badge] = await db.select().from(badgeDefinition).where(eq(badgeDefinition.id, badgeId));
    await db.insert(xpEntry).values({
      studentId,
      xpAmount: badge.criteriaValue * 10,
      sourceType: 'badge',
      sourceId: awarded.id,
    });

    return reply.status(201).send(awarded);
  });
}
