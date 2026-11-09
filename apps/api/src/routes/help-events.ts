import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';

const TYPES = ['search_miss', 'section_open'];
const GUIDES = ['owner', 'student'];

// Help usage signal: one JSON log line per event, read with `fly logs | grep help_event`. No DB, no user identity.
export async function helpEventRoutes(app: FastifyInstance) {
  app.post('/api/help/events', { preHandler: [requireAuth, injectAcademyId] }, async (request, reply) => {
    const { type, guide, value } = (request.body ?? {}) as Record<string, unknown>;
    const text = typeof value === 'string' ? value.trim() : '';
    if (!TYPES.includes(type as string) || !GUIDES.includes(guide as string) || !text || text.length > 200) {
      return reply.status(400).send({ error: 'Invalid help event' });
    }
    console.log(
      JSON.stringify({
        event: 'help_event',
        academyId: request.academyId,
        role: request.user.role,
        type,
        guide,
        value: text,
        ts: new Date().toISOString(),
      }),
    );
    return reply.status(204).send();
  });
}
