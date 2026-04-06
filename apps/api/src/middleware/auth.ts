import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth/index.js';
import { fromNodeHeaders } from 'better-auth/node';

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
    return;
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
}

export async function requireInstructor(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user.role !== 'instructor') {
    return reply.status(403).send({ error: 'Forbidden: instructor only' });
  }
}
