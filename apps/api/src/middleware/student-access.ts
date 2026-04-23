import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { user } from '../db/schema/index.js';
import { requireAuth } from './auth.js';

/**
 * Authorize a read on a student-scoped resource. Allows the student to read
 * their own data, or an instructor/owner in the same academy to read any
 * student of that academy. Returns 401/403/404 otherwise.
 *
 * @param paramName Name of the route param holding the student id
 *                  (e.g. 'studentId' or 'id').
 */
export function authorizeStudentRead(paramName: string) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const params = request.params as Record<string, string>;
    const studentId = params[paramName];

    if (request.user.id === studentId) return;

    const role = request.user.role;
    if (role !== 'instructor' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const [target] = await db
      .select({ academyId: user.academyId })
      .from(user)
      .where(eq(user.id, studentId))
      .limit(1);

    if (!target) return reply.status(404).send({ error: 'Student not found' });
    if (target.academyId !== request.user.academyId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
