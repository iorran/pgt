import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { academy, bjjClass, seminarParticipant, user } from '../db/schema/index.js';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { DEFAULT_ACADEMY_TIMEZONE, isoDateInTz } from '../utils/timezone.js';
import { UUID } from './families.js';
import { money } from './classes.js';

type ParticipantRow = typeof seminarParticipant.$inferSelect;

// The participant as the app shows it; a Student's name comes from their account.
function present(p: ParticipantRow, studentName?: string | null) {
  return {
    id: p.id,
    kind: p.studentId ? 'student' : 'outsider',
    studentId: p.studentId,
    name: p.studentId ? studentName ?? null : p.name,
    phone: p.phone,
    amount: p.amount,
    paidAt: p.paidAt,
  };
}

async function findSeminar(classId: string, academyId: string) {
  if (!UUID.test(classId)) {
    return null;
  }
  const [row] = await db
    .select({ cls: bjjClass, tz: academy.timezone })
    .from(bjjClass)
    .innerJoin(academy, eq(academy.id, bjjClass.academyId))
    .where(and(
      eq(bjjClass.id, classId),
      eq(bjjClass.academyId, academyId),
      eq(bjjClass.isSeminar, true),
      eq(bjjClass.active, true),
    ));
  return row ? { ...row.cls, tz: row.tz ?? DEFAULT_ACADEMY_TIMEZONE } : null;
}

async function findParticipant(id: string, academyId: string) {
  if (!UUID.test(id)) {
    return null;
  }
  const [row] = await db
    .select({ p: seminarParticipant, tz: academy.timezone, studentName: user.name })
    .from(seminarParticipant)
    .innerJoin(bjjClass, eq(bjjClass.id, seminarParticipant.classId))
    .innerJoin(academy, eq(academy.id, bjjClass.academyId))
    .leftJoin(user, eq(user.id, seminarParticipant.studentId))
    .where(and(eq(seminarParticipant.id, id), eq(bjjClass.academyId, academyId)));
  return row ?? null;
}

async function participantOf(classId: string, studentId: string) {
  const [row] = await db
    .select()
    .from(seminarParticipant)
    .where(and(eq(seminarParticipant.classId, classId), eq(seminarParticipant.studentId, studentId)));
  return row ?? null;
}

const notFound = { error: 'SEMINAR_NOT_FOUND' };

export async function seminarRoutes(app: FastifyInstance) {
  const owner = { preHandler: [requireOwner, injectAcademyId] };
  const member = { preHandler: [requireAuth, injectAcademyId] };

  // Every Seminar of the academy, by date, with who is in and the money received and pending.
  app.get('/api/seminars', owner, async (request) => {
    const rows = await db
      .select({
        cls: bjjClass,
        teacherName: user.name,
        teacherBelt: user.belt,
        participants: sql<number>`count(${seminarParticipant.id})::int`,
        paidCount: sql<number>`count(${seminarParticipant.paidAt})::int`,
        received: sql<string>`coalesce(sum(${seminarParticipant.amount}) filter (where ${seminarParticipant.paidAt} is not null), 0)::numeric(10,2)::text`,
        pending: sql<string>`coalesce(sum(${seminarParticipant.amount}) filter (where ${seminarParticipant.paidAt} is null), 0)::numeric(10,2)::text`,
      })
      .from(bjjClass)
      .leftJoin(user, eq(user.id, bjjClass.teacherId))
      .leftJoin(seminarParticipant, eq(seminarParticipant.classId, bjjClass.id))
      .where(and(eq(bjjClass.academyId, request.academyId), eq(bjjClass.isSeminar, true), eq(bjjClass.active, true)))
      .groupBy(bjjClass.id, user.name, user.belt)
      .orderBy(asc(bjjClass.date), asc(bjjClass.startTime));
    return rows.map(({ cls, teacherName, teacherBelt, ...totals }) => ({
      classId: cls.id,
      name: cls.name,
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      teacher: cls.teacherId ? { id: cls.teacherId, name: teacherName, belt: teacherBelt } : null,
      guestTeacherName: cls.guestTeacherName,
      ...totals,
    }));
  });

  app.get('/api/seminars/:classId/participants', owner, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const seminar = await findSeminar(classId, request.academyId);
    if (!seminar) {
      return reply.status(404).send(notFound);
    }
    const rows = await db
      .select({ p: seminarParticipant, studentName: user.name })
      .from(seminarParticipant)
      .leftJoin(user, eq(user.id, seminarParticipant.studentId))
      .where(eq(seminarParticipant.classId, classId));
    return rows
      .map(({ p, studentName }) => present(p, studentName))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  });

  app.post('/api/seminars/:classId/participants', owner, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const body = (request.body ?? {}) as { studentId?: string; name?: string; phone?: string; amount?: unknown };
    const seminar = await findSeminar(classId, request.academyId);
    if (!seminar) {
      return reply.status(404).send(notFound);
    }
    const amount = body.amount === undefined ? undefined : money(body.amount);
    if (amount === null) {
      return reply.status(400).send({ error: 'INVALID_AMOUNT' });
    }

    if (body.studentId) {
      const [student] = UUID.test(body.studentId)
        ? await db.select({ id: user.id, name: user.name }).from(user)
            .where(and(eq(user.id, body.studentId), eq(user.academyId, request.academyId)))
        : [];
      if (!student) {
        return reply.status(400).send({ error: 'INVALID_STUDENT' });
      }
      if (await participantOf(classId, student.id)) {
        return reply.status(409).send({ error: 'ALREADY_PARTICIPANT' });
      }
      const [created] = await db.insert(seminarParticipant).values({
        classId,
        studentId: student.id,
        amount: amount ?? seminar.studentPrice ?? '0.00',
      }).returning();
      return reply.status(201).send(present(created, student.name));
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return reply.status(400).send({ error: 'NAME_REQUIRED' });
    }
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const [created] = await db.insert(seminarParticipant).values({
      classId,
      name,
      phone: phone || null,
      amount: amount ?? seminar.outsiderPrice ?? '0.00',
    }).returning();
    return reply.status(201).send(present(created));
  });

  app.patch('/api/seminar-participants/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { amount?: unknown; paid?: boolean };
    const found = await findParticipant(id, request.academyId);
    if (!found) {
      return reply.status(404).send({ error: 'PARTICIPANT_NOT_FOUND' });
    }
    const changes: Partial<ParticipantRow> = {};
    if (body.amount !== undefined) {
      const amount = money(body.amount);
      if (amount === null) {
        return reply.status(400).send({ error: 'INVALID_AMOUNT' });
      }
      changes.amount = amount;
    }
    if (body.paid !== undefined) {
      changes.paidAt = body.paid ? isoDateInTz(new Date(), found.tz ?? DEFAULT_ACADEMY_TIMEZONE) : null;
    }
    if (Object.keys(changes).length === 0) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }
    const [updated] = await db.update(seminarParticipant).set(changes)
      .where(eq(seminarParticipant.id, id)).returning();
    return present(updated, found.studentName);
  });

  app.delete('/api/seminar-participants/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await findParticipant(id, request.academyId))) {
      return reply.status(404).send({ error: 'PARTICIPANT_NOT_FOUND' });
    }
    await db.delete(seminarParticipant).where(eq(seminarParticipant.id, id));
    return reply.status(204).send();
  });

  // A Student (or the Dependent being acted as) signs themself up, pending, at the Student price.
  app.post('/api/seminars/:classId/signup', member, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const seminar = await findSeminar(classId, request.academyId);
    if (!seminar) {
      return reply.status(404).send(notFound);
    }
    if (seminar.date! < isoDateInTz(new Date(), seminar.tz)) {
      return reply.status(400).send({ error: 'SEMINAR_PAST' });
    }
    if (await participantOf(classId, request.user.id)) {
      return reply.status(409).send({ error: 'ALREADY_PARTICIPANT' });
    }
    const [created] = await db.insert(seminarParticipant).values({
      classId,
      studentId: request.user.id,
      amount: seminar.studentPrice ?? '0.00',
    }).returning();
    return reply.status(201).send(present(created, request.user.name));
  });

  // Cancelling is only possible while pending; refunds happen outside the app.
  app.delete('/api/seminars/:classId/signup', member, async (request, reply) => {
    const { classId } = request.params as { classId: string };
    const seminar = await findSeminar(classId, request.academyId);
    const mine = seminar ? await participantOf(classId, request.user.id) : null;
    if (!mine) {
      return reply.status(404).send({ error: 'PARTICIPANT_NOT_FOUND' });
    }
    if (mine.paidAt) {
      return reply.status(409).send({ error: 'SEMINAR_ALREADY_PAID' });
    }
    await db.delete(seminarParticipant).where(eq(seminarParticipant.id, mine.id));
    return reply.status(204).send();
  });

  app.get('/api/seminars/mine', member, async (request) => {
    const rows = await db
      .select({ p: seminarParticipant, cls: bjjClass, teacherName: user.name, teacherBelt: user.belt })
      .from(seminarParticipant)
      .innerJoin(bjjClass, eq(bjjClass.id, seminarParticipant.classId))
      .leftJoin(user, eq(user.id, bjjClass.teacherId))
      .where(and(
        eq(seminarParticipant.studentId, request.user.id),
        eq(bjjClass.academyId, request.academyId),
        eq(bjjClass.active, true),
      ))
      .orderBy(desc(bjjClass.date));
    return rows.map(({ p, cls, teacherName, teacherBelt }) => ({
      classId: cls.id,
      name: cls.name,
      date: cls.date,
      startTime: cls.startTime,
      endTime: cls.endTime,
      teacher: cls.teacherId ? { id: cls.teacherId, name: teacherName, belt: teacherBelt } : null,
      guestTeacherName: cls.guestTeacherName,
      amount: p.amount,
      paidAt: p.paidAt,
    }));
  });
}
