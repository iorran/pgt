import { FastifyInstance } from 'fastify';
import { auth } from '../auth/index.js';
import { env } from '../env.js';

function setCors(reply: any, origin: string) {
  const allowedOrigin = env.TRUSTED_ORIGINS.includes(origin) ? origin : env.TRUSTED_ORIGINS[0];
  reply.header('Access-Control-Allow-Origin', allowedOrigin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function authRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.all('/api/auth/*', async (request, reply) => {
    const origin = request.headers.origin || '';
    setCors(reply, origin);

    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }

    // Convert Fastify request to Web API Request
    const url = `${request.protocol}://${request.hostname}${request.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const webRequest = new Request(url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? (request.body as string)
        : undefined,
    });

    const response = await auth.handler(webRequest);

    // Forward status and BetterAuth headers (e.g. set-cookie)
    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    // Re-apply CORS (in case BetterAuth overwrote them)
    setCors(reply, origin);

    const body = await response.text();
    return reply.send(body);
  });
}
