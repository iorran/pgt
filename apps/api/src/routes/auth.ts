import { FastifyInstance } from 'fastify';
import { auth } from '../auth/index.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function setCors(reply: any) {
  reply.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function authRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.all('/api/auth/*', async (request, reply) => {
    setCors(reply);

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
    setCors(reply);

    const body = await response.text();
    return reply.send(body);
  });
}
