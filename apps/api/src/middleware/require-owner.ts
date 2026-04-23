import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { academy } from '../db/schema/academy.js';
import { requireAuth } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    academy?: { id: string; ownerId: string | null; timezone: string };
  }
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.user.role !== 'owner') {
    return reply.status(403).send({ error: 'Forbidden: owner only' });
  }
  if (!request.user.academyId) {
    return reply.status(400).send({ error: 'No academy associated' });
  }

  const [row] = await db
    .select({ id: academy.id, ownerId: academy.ownerId, timezone: academy.timezone })
    .from(academy)
    .where(eq(academy.id, request.user.academyId))
    .limit(1);

  if (!row) return reply.status(404).send({ error: 'Academy not found' });
  if (row.ownerId !== request.user.id) {
    return reply.status(403).send({ error: 'Forbidden: not the academy owner' });
  }

  request.academy = row;
}
