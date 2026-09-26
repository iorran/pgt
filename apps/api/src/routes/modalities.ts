import { FastifyInstance } from 'fastify';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { modality, studentModality } from '../db/schema/index.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { UUID } from './families.js';

// Modalities with how many students train each, sorted by name; optionally just one.
function listModalities(academyId: string, id?: string) {
  return db
    .select({ id: modality.id, name: modality.name, studentCount: count(studentModality.studentId) })
    .from(modality)
    .leftJoin(studentModality, eq(studentModality.modalityId, modality.id))
    .where(and(eq(modality.academyId, academyId), id ? eq(modality.id, id) : undefined))
    .groupBy(modality.id)
    .orderBy(asc(modality.name));
}

async function findModality(id: string, academyId: string) {
  if (!UUID.test(id)) {
    return undefined;
  }
  const [row] = await listModalities(academyId, id);
  return row;
}

function cleanName(name: unknown): string | null {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed && trimmed.length <= 100 ? trimmed : null;
}

// Case-insensitive: "kids" clashes with "Kids".
async function nameTaken(academyId: string, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: modality.id })
    .from(modality)
    .where(and(
      eq(modality.academyId, academyId),
      sql`lower(${modality.name}) = lower(${name})`,
      exceptId ? ne(modality.id, exceptId) : undefined,
    ));
  return !!row;
}

export async function modalityRoutes(app: FastifyInstance) {
  app.get('/api/modalities', { preHandler: [requireAuth, injectAcademyId] }, async (request) => {
    return listModalities(request.academyId);
  });

  app.post('/api/modalities', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const name = cleanName((request.body as { name?: unknown } | undefined)?.name);
    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (await nameTaken(request.academyId, name)) {
      return reply.status(409).send({ error: 'MODALITY_EXISTS' });
    }
    const [created] = await db
      .insert(modality)
      .values({ academyId: request.academyId, name })
      .returning({ id: modality.id, name: modality.name });
    return reply.status(201).send({ ...created, studentCount: 0 });
  });

  app.put('/api/modalities/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const name = cleanName((request.body as { name?: unknown } | undefined)?.name);
    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }
    const existing = await findModality(id, request.academyId);
    if (!existing) {
      return reply.status(404).send({ error: 'Modality not found' });
    }
    if (await nameTaken(request.academyId, name, id)) {
      return reply.status(409).send({ error: 'MODALITY_EXISTS' });
    }
    await db.update(modality).set({ name }).where(eq(modality.id, id));
    return { ...existing, name };
  });

  // Only unused modalities can be deleted, so tagging history is never lost silently.
  app.delete('/api/modalities/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await findModality(id, request.academyId);
    if (!existing) {
      return reply.status(404).send({ error: 'Modality not found' });
    }
    if (existing.studentCount > 0) {
      return reply.status(409).send({ error: 'MODALITY_IN_USE', studentCount: existing.studentCount });
    }
    await db.delete(modality).where(eq(modality.id, id));
    return reply.status(204).send();
  });
}
