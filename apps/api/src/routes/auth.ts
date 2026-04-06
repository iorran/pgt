import { FastifyInstance } from 'fastify';
import { auth } from '../auth/index.js';
import { toNodeHandler } from 'better-auth/node';

export async function authRoutes(app: FastifyInstance) {
  app.all('/api/auth/*', async (request, reply) => {
    const handler = toNodeHandler(auth);
    // Bridge Fastify <-> Node handler
    return handler(request.raw, reply.raw);
  });
}
