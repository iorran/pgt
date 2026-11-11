import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { bjjClass, user } from '../db/schema/index.js';
import { eq, and, or, asc } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { DATE, UUID } from './families.js';

type ClassRow = typeof bjjClass.$inferSelect;
type ClassFields = Partial<Omit<ClassRow, 'id' | 'academyId' | 'instructorId' | 'active'>>;

// A non-negative money amount as the decimal string Postgres stores, or null when absent or invalid.
export function money(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

// Validates a class as it will be stored and fills derived fields; returns an error code or the clean fields.
async function normalizeClass(
  fields: ClassFields,
  academyId: string,
): Promise<{ error: string } | { values: ClassFields }> {
  const values: ClassFields = { ...fields };

  if (values.recurrence === 'once') {
    if (typeof values.date !== 'string' || !DATE.test(values.date)) {
      return { error: 'DATE_REQUIRED' };
    }
    values.dayOfWeek = weekdayOf(values.date);
  } else {
    if (!Number.isInteger(values.dayOfWeek) || values.dayOfWeek! < 0 || values.dayOfWeek! > 6) {
      return { error: 'DAY_REQUIRED' };
    }
    values.date = null;
  }

  const guest = typeof values.guestTeacherName === 'string' ? values.guestTeacherName.trim() : '';
  values.guestTeacherName = guest || null;
  values.teacherId = values.teacherId || null;
  if (values.teacherId && values.guestTeacherName) {
    return { error: 'ONE_TEACHER_ONLY' };
  }

  if (values.isSeminar) {
    if (values.recurrence !== 'once') {
      return { error: 'SEMINAR_MUST_BE_ONCE' };
    }
    values.studentPrice = money(values.studentPrice);
    values.outsiderPrice = money(values.outsiderPrice);
    if (values.studentPrice === null || values.outsiderPrice === null) {
      return { error: 'SEMINAR_PRICE_REQUIRED' };
    }
  } else {
    if (values.guestTeacherName) {
      return { error: 'GUEST_TEACHER_SEMINAR_ONLY' };
    }
    values.studentPrice = null;
    values.outsiderPrice = null;
  }

  if (values.teacherId) {
    const [teacher] = UUID.test(values.teacherId)
      ? await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, values.teacherId), eq(user.academyId, academyId)))
      : [];
    if (!teacher) {
      return { error: 'INVALID_TEACHER' };
    }
  }

  return { values };
}

export async function classRoutes(app: FastifyInstance) {
  // List classes for academy, with each class's teacher
  app.get('/api/classes', { preHandler: [requireAuth, injectAcademyId] }, async (request) => {
    const rows = await db
      .select({ cls: bjjClass, teacherName: user.name, teacherBelt: user.belt })
      .from(bjjClass)
      .leftJoin(user, eq(user.id, bjjClass.teacherId))
      .where(and(eq(bjjClass.academyId, request.academyId), eq(bjjClass.active, true)));
    return rows.map(({ cls, teacherName, teacherBelt }) => ({
      ...cls,
      teacher: cls.teacherId ? { id: cls.teacherId, name: teacherName, belt: teacherBelt } : null,
    }));
  });

  // People the Owner can pick as a Class Teacher: active students and the Owner
  app.get('/api/teachers/candidates', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    return db
      .select({ id: user.id, name: user.name, belt: user.belt, role: user.role })
      .from(user)
      .where(and(
        eq(user.academyId, request.academyId),
        or(and(eq(user.role, 'student'), eq(user.status, 'active')), eq(user.role, 'owner')),
      ))
      .orderBy(asc(user.name));
  });

  // Create class (owner only)
  app.post('/api/classes', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, any>;
    const result = await normalizeClass({
      name: body.name,
      type: body.type,
      recurrence: body.recurrence,
      dayOfWeek: body.dayOfWeek,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      teacherId: body.teacherId,
      guestTeacherName: body.guestTeacherName,
      isSeminar: body.isSeminar === true,
      studentPrice: body.studentPrice,
      outsiderPrice: body.outsiderPrice,
    }, request.academyId);
    if ('error' in result) {
      return reply.status(400).send(result);
    }
    const [created] = await db.insert(bjjClass).values({
      ...result.values,
      academyId: request.academyId,
      instructorId: request.user.id,
    } as typeof bjjClass.$inferInsert).returning();
    return reply.status(201).send(created);
  });

  // Update class
  app.put('/api/classes/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    // instructorId, academyId, active and isSeminar are not editable here.
    const editable = [
      'name', 'type', 'recurrence', 'dayOfWeek', 'date', 'startTime', 'endTime',
      'teacherId', 'guestTeacherName', 'studentPrice', 'outsiderPrice',
    ];
    const changes = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
    if (Object.keys(changes).length === 0) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }
    const [existing] = UUID.test(id)
      ? await db.select().from(bjjClass)
          .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      : [];
    if (!existing) {
      return reply.status(404).send({ error: 'CLASS_NOT_FOUND' });
    }
    const { id: _id, academyId: _a, instructorId: _i, active: _act, ...current } = existing;
    const result = await normalizeClass({ ...current, ...changes }, request.academyId);
    if ('error' in result) {
      return reply.status(400).send(result);
    }
    const [updated] = await db.update(bjjClass)
      .set(result.values)
      .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
      .returning();
    return updated;
  });

  // Delete (deactivate) class
  app.delete('/api/classes/:id', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [updated] = UUID.test(id)
      ? await db.update(bjjClass)
          .set({ active: false })
          .where(and(eq(bjjClass.id, id), eq(bjjClass.academyId, request.academyId)))
          .returning()
      : [];
    if (!updated) {
      return reply.status(404).send({ error: 'CLASS_NOT_FOUND' });
    }
    return updated;
  });
}
