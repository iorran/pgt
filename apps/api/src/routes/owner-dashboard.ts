import { FastifyInstance } from 'fastify';
import { requireOwner } from '../middleware/require-owner.js';

export async function ownerDashboardRoutes(app: FastifyInstance) {
  app.get('/api/owner/students', { preHandler: requireOwner }, async () => {
    return { students: [] };
  });
}
