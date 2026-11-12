import { FastifyInstance } from 'fastify';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { family, user } from '../db/schema/index.js';
import { requireAuth } from '../middleware/auth.js';
import { payoutsFor } from './finance.js';
import { MONTH } from './families.js';

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
      .where(and(
        eq(family.responsibleUserId, actorId),
        isNull(family.deletedAt),
        ne(user.id, actorId),
        eq(user.academyId, family.academyId),
      ))
      .orderBy(asc(user.name));
    const { role, ...selfProfile } = self;
    return {
      actorId,
      currentId: request.user.id,
      self: role === 'responsible' ? null : selfProfile,
      dependents,
    };
  });

  // The agreements the current profile teaches, month by month: who is in them and whether they paid,
  // never what anyone pays. The payout total shows only once the Owner confirmed it (ADR 0006).
  app.get('/api/me/agreements', { preHandler: [requireAuth] }, async (request, reply) => {
    const { month } = request.query as { month?: string };
    if (typeof month !== 'string' || !MONTH.test(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    const { id, academyId } = request.user;
    if (!academyId) {
      return [];
    }
    const payouts = await payoutsFor(academyId, month);
    return payouts
      .filter((p) => p.agreement.teachers.some((t) => t.id === id))
      .map((p) => ({
        agreement: { id: p.agreement.id, name: p.agreement.name, teachers: p.agreement.teachers },
        month,
        confirmed: p.confirmed,
        students: p.students.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          kind: s.kind,
          checkins: s.checkins,
          paid: s.payments.length > 0,
        })),
      }));
  });
}
