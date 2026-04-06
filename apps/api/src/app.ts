import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from './routes/auth.js';
import { classRoutes } from './routes/classes.js';
import { checkinRoutes } from './routes/checkins.js';
import { membershipPlanRoutes } from './routes/membership-plans.js';
import { studentRoutes } from './routes/students.js';
import { paymentRoutes } from './routes/payments.js';
import { productRoutes } from './routes/products.js';
import { orderRoutes } from './routes/orders.js';
import { seasonRoutes } from './routes/seasons.js';

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
  await app.register(classRoutes);
  await app.register(checkinRoutes);
  await app.register(membershipPlanRoutes);
  await app.register(studentRoutes);
  await app.register(paymentRoutes);
  await app.register(productRoutes);
  await app.register(orderRoutes);
  await app.register(seasonRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
