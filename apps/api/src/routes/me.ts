import { FastifyInstance } from 'fastify';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { family, user } from '../db/schema/index.js';
import { requireAuth } from '../middleware/auth.js';

const profileFields = { id: user.id, name: user.name, belt: user.belt, image: user.image };

export async function meRoutes(app: FastifyInstance) {
  // Profiles the logged-in user can use: themself (unless they only manage a Family) and their Dependents.
  app.get('/api/me/profiles', { preHandler: [requireAuth] }, async (request) => {
    const actorId = request.actor.id;
    const [self] = await db.select({ ...profileFields, role: user.role }).from(user).where(eq(user.id, actorId));
    const dependents = await db
      .select(profileFields)
      .from(user)
      .innerJoin(family, eq(family.id, user.familyId))
      .where(and(eq(family.responsibleUserId, actorId), isNull(family.deletedAt), ne(user.id, actorId)))
      .orderBy(asc(user.name));
    const { role, ...selfProfile } = self;
    return {
      actorId,
      currentId: request.user.id,
      self: role === 'responsible' ? null : selfProfile,
      dependents,
    };
  });
}
