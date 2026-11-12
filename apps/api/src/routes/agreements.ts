import { FastifyInstance } from 'fastify';
import { and, asc, eq, inArray, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agreementTeacher, teacherAgreement, user } from '../db/schema/index.js';
import { requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { money } from './classes.js';
import { UUID } from './families.js';

const owner = { preHandler: [requireOwner, injectAcademyId] };

type Agreement = typeof teacherAgreement.$inferSelect;

// Teachers of each agreement, sorted by name.
export async function teachersOf(agreementIds: string[]) {
  const byAgreement = new Map<string, { id: string; name: string }[]>(agreementIds.map((id) => [id, []]));
  if (agreementIds.length === 0) {
    return byAgreement;
  }
  const rows = await db
    .select({ agreementId: agreementTeacher.agreementId, id: user.id, name: user.name })
    .from(agreementTeacher)
    .innerJoin(user, eq(user.id, agreementTeacher.teacherId))
    .where(inArray(agreementTeacher.agreementId, agreementIds))
    .orderBy(asc(user.name));
  for (const r of rows) {
    byAgreement.get(r.agreementId)!.push({ id: r.id, name: r.name });
  }
  return byAgreement;
}

async function present(rows: Agreement[]) {
  const ids = rows.map((r) => r.id);
  const [teachers, links] = await Promise.all([
    teachersOf(ids),
    ids.length === 0
      ? []
      : db
          .select({ agreementId: user.agreementId, kind: user.agreementKind, n: count() })
          .from(user)
          .where(inArray(user.agreementId, ids))
          .groupBy(user.agreementId, user.agreementKind),
  ]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sharePercent: r.sharePercent,
    addOnPrice: r.addOnPrice,
    active: r.active,
    teachers: teachers.get(r.id)!,
    students: {
      recruited: links.find((l) => l.agreementId === r.id && l.kind === 'recruited')?.n ?? 0,
      addOn: links.find((l) => l.agreementId === r.id && l.kind === 'addOn')?.n ?? 0,
    },
  }));
}

function parseBody(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const percent = body.sharePercent;
  const addOnPrice = body.addOnPrice === null ? null : money(body.addOnPrice);
  const teacherIds = Array.isArray(body.teacherIds) ? [...new Set(body.teacherIds)] : [];
  const valid =
    name.length > 0 &&
    name.length <= 50 &&
    Number.isInteger(percent) &&
    (percent as number) >= 0 &&
    (percent as number) <= 100 &&
    (body.addOnPrice === null || addOnPrice !== null) &&
    teacherIds.length > 0;
  return valid ? { name, sharePercent: percent as number, addOnPrice, teacherIds } : null;
}

// Teachers must be active Students of the academy (a Class Teacher other than the Owner).
async function validTeachers(teacherIds: unknown[], academyId: string) {
  if (!teacherIds.every((id) => typeof id === 'string' && UUID.test(id))) {
    return false;
  }
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        inArray(user.id, teacherIds as string[]),
        eq(user.academyId, academyId),
        eq(user.role, 'student'),
        eq(user.status, 'active'),
      ),
    );
  return rows.length === teacherIds.length;
}

async function findAgreement(id: string, academyId: string) {
  if (!UUID.test(id)) {
    return undefined;
  }
  const [row] = await db
    .select()
    .from(teacherAgreement)
    .where(and(eq(teacherAgreement.id, id), eq(teacherAgreement.academyId, academyId)));
  return row;
}

export async function agreementRoutes(app: FastifyInstance) {
  app.get('/api/agreements', owner, async (request) => {
    const rows = await db
      .select()
      .from(teacherAgreement)
      .where(eq(teacherAgreement.academyId, request.academyId))
      .orderBy(asc(teacherAgreement.createdAt), asc(teacherAgreement.id));
    return present(rows);
  });

  app.post('/api/agreements', owner, async (request, reply) => {
    const body = parseBody((request.body ?? {}) as Record<string, unknown>);
    if (!body) {
      return reply.status(400).send({ error: 'INVALID_AGREEMENT' });
    }
    if (!(await validTeachers(body.teacherIds, request.academyId))) {
      return reply.status(400).send({ error: 'INVALID_PAYOUT_TEACHER' });
    }
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(teacherAgreement)
        .values({
          academyId: request.academyId,
          name: body.name,
          sharePercent: body.sharePercent,
          addOnPrice: body.addOnPrice,
        })
        .returning();
      await tx.insert(agreementTeacher).values(body.teacherIds.map((teacherId) => ({ agreementId: row.id, teacherId: teacherId as string })));
      return row;
    });
    return reply.status(201).send((await present([created]))[0]);
  });

  app.put('/api/agreements/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await findAgreement(id, request.academyId);
    if (!existing) {
      return reply.status(404).send({ error: 'Agreement not found' });
    }
    const body = parseBody((request.body ?? {}) as Record<string, unknown>);
    if (!body || !existing.active) {
      return reply.status(400).send({ error: 'INVALID_AGREEMENT' });
    }
    if (!(await validTeachers(body.teacherIds, request.academyId))) {
      return reply.status(400).send({ error: 'INVALID_PAYOUT_TEACHER' });
    }
    if (body.addOnPrice === null) {
      const [addOnStudent] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.agreementId, id), eq(user.agreementKind, 'addOn')))
        .limit(1);
      if (addOnStudent) {
        return reply.status(409).send({ error: 'AGREEMENT_HAS_ADD_ON_STUDENTS' });
      }
    }
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(teacherAgreement)
        .set({ name: body.name, sharePercent: body.sharePercent, addOnPrice: body.addOnPrice })
        .where(eq(teacherAgreement.id, id))
        .returning();
      await tx.delete(agreementTeacher).where(eq(agreementTeacher.agreementId, id));
      await tx.insert(agreementTeacher).values(body.teacherIds.map((teacherId) => ({ agreementId: id, teacherId: teacherId as string })));
      // A teacher who is now on the agreement can't stay linked to it as a Student.
      await tx
        .update(user)
        .set({ agreementId: null, agreementKind: null, updatedAt: new Date() })
        .where(and(eq(user.agreementId, id), inArray(user.id, body.teacherIds as string[])));
      return row;
    });
    return (await present([updated]))[0];
  });

  // Ending keeps the agreement and its confirmed payouts; its Students are unlinked.
  app.post('/api/agreements/:id/end', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await findAgreement(id, request.academyId))) {
      return reply.status(404).send({ error: 'Agreement not found' });
    }
    const ended = await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ agreementId: null, agreementKind: null, updatedAt: new Date() })
        .where(eq(user.agreementId, id));
      const [row] = await tx.update(teacherAgreement).set({ active: false }).where(eq(teacherAgreement.id, id)).returning();
      return row;
    });
    return (await present([ended]))[0];
  });
}
