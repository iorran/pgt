import { FastifyInstance } from 'fastify';
import { auth } from '../auth/index.js';
import { toNodeHandler } from 'better-auth/node';

const ALLOWED_ORIGIN = 'http://localhost:5173';

export async function authRoutes(app: FastifyInstance) {
  const handler = toNodeHandler(auth);

  app.all('/api/auth/*', async (request, reply) => {
    // Set CORS headers manually since toNodeHandler bypasses Fastify
    reply.raw.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      reply.raw.statusCode = 204;
      reply.raw.end();
      return reply.hijack();
    }

    await handler(request.raw, reply.raw);
    return reply.hijack();
  });
}
