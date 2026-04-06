import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: any;
    user: any;
    academyId: string;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(authRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
