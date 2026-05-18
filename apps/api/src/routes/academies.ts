import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { academy, user } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { generateJoinCode } from '../utils/join-code.js';

export async function academyRoutes(app: FastifyInstance) {
  // Create academy (authenticated user, no academy yet)
  app.post('/api/academies', { preHandler: [requireAuth] }, async (request, reply) => {
    const { name, city } = request.body as { name: string; city: string };
    const userId = request.user.id;

    // Generate slug and join code
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    let joinCode = generateJoinCode(name);

    // Insert academy (retry join code on collision)
    let created;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        [created] = await db.insert(academy).values({
          name,
          slug: `${slug}-${Date.now().toString(36)}`,
          joinCode,
          city,
          ownerId: userId,
        }).returning();
        break;
      } catch (e: any) {
        if (e.code === '23505' && attempt < 2) { // unique violation
          joinCode = generateJoinCode(name);
          continue;
        }
        throw e;
      }
    }

    // Update user to owner with this academy
    await db.update(user)
      .set({ academyId: created!.id, role: 'owner', status: 'active' })
      .where(eq(user.id, userId));

    return reply.status(201).send(created);
  });

  // Public: lookup academy by join code
  app.get('/api/academies/by-code/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const [found] = await db.select({
      id: academy.id,
      name: academy.name,
      city: academy.city,
    }).from(academy).where(eq(academy.joinCode, code));

    if (!found) return reply.status(404).send({ error: 'Academy not found' });
    return found;
  });

  // Student joins academy (sets status to pending)
  app.post('/api/academies/:id/join', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify academy exists
    const [found] = await db.select().from(academy).where(eq(academy.id, id));
    if (!found) return reply.status(404).send({ error: 'Academy not found' });

    // Update user
    await db.update(user)
      .set({ academyId: id, status: 'pending', role: 'student' })
      .where(eq(user.id, request.user.id));

    return { status: 'pending' };
  });

  // Get my academy details (for join code display)
  app.get('/api/academies/mine', { preHandler: [requireAuth] }, async (request, reply) => {
    const academyId = request.user.academyId;
    if (!academyId) return reply.status(404).send({ error: 'No academy' });

    const [found] = await db.select().from(academy).where(eq(academy.id, academyId));
    if (!found) return reply.status(404).send({ error: 'Academy not found' });
    return found;
  });

  // List pending students (owner only)
  app.get('/api/academies/:id/pending', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { id } = request.params as { id: string };
    return db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      belt: user.belt,
      createdAt: user.createdAt,
    }).from(user).where(and(eq(user.academyId, id), eq(user.status, 'pending')));
  });

  // Approve student
  app.post('/api/academies/:id/approve/:userId', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const [updated] = await db.update(user)
      .set({ status: 'active' })
      .where(and(eq(user.id, userId), eq(user.academyId, id), eq(user.status, 'pending')))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Student not found or not pending' });
    return updated;
  });

  // Reject student
  app.post('/api/academies/:id/reject/:userId', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const [updated] = await db.update(user)
      .set({ status: 'rejected' })
      .where(and(eq(user.id, userId), eq(user.academyId, id), eq(user.status, 'pending')))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Student not found or not pending' });
    return updated;
  });

  // Update academy location (owner only)
  app.put('/api/academies/:id/location', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { latitude, longitude, address } = request.body as {
      latitude: number;
      longitude: number;
      address?: string;
    };

    const [updated] = await db.update(academy)
      .set({
        latitude: String(latitude),
        longitude: String(longitude),
        ...(address !== undefined && { address }),
      })
      .where(and(eq(academy.id, id), eq(academy.id, request.academyId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Academy not found' });
    return updated;
  });
}
