import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { family, user } from '../db/schema/index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user the logged-in Responsible may act as, or null if not one of their Dependents (ADR 0004). */
export async function findDependent(responsibleId: string, dependentId: string) {
  const [row] = await db
    .select({ id: user.id, role: user.role, academyId: user.academyId, status: user.status, name: user.name, email: user.email })
    .from(user)
    .innerJoin(family, eq(family.id, user.familyId))
    .where(and(eq(user.id, dependentId), eq(family.responsibleUserId, responsibleId), isNull(family.deletedAt)));
  return row ?? null;
}

// Swaps request.user for the Dependent named in x-acting-as; every student route then answers for them.
async function applyActingAs(request: FastifyRequest, reply: FastifyReply) {
  request.actor = request.user;
  const actingAs = request.headers['x-acting-as'];
  if (typeof actingAs !== 'string' || !actingAs || actingAs === request.user.id) {
    return;
  }
  const dependent = UUID_RE.test(actingAs) ? await findDependent(request.user.id, actingAs) : null;
  if (!dependent) {
    return reply.status(403).send({ error: 'Forbidden: not your dependent' });
  }
  request.user = dependent;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // Test mode: accept x-test-user-* headers
  if (process.env.NODE_ENV === 'test' && request.headers['x-test-user-id']) {
    request.user = {
      id: request.headers['x-test-user-id'] as string,
      role: request.headers['x-test-user-role'] as string,
      academyId: (request.headers['x-test-user-academy-id'] as string) || null,
      status: (request.headers['x-test-user-status'] as string) || 'active',
    };
    request.session = { id: 'test-session' };
    return applyActingAs(request, reply);
  }

  // Production: use BetterAuth
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  request.session = session.session;
  request.user = session.user;
  return applyActingAs(request, reply);
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.role !== 'owner') {
    return reply.status(403).send({ error: 'Forbidden: owner only' });
  }
}
