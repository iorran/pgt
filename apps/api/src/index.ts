import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './env.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});
await app.register(cookie);

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`API running on http://localhost:${env.PORT}`);
