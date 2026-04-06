import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  request.session = session.session;
  request.user = session.user;
}

export async function requireInstructor(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.role !== 'instructor') {
    return reply.status(403).send({ error: 'Forbidden: instructor only' });
  }
}
