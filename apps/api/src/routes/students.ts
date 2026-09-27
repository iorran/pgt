import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { user, studentMembership, family, waivedMonth, modality, studentModality, beltEnum } from '../db/schema/index.js';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { dateKey } from '../billing/rules.js';
import { DATE, MONEY, MONTH, UUID } from './families.js';

// Columns shared by the list and detail rows.
const studentColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  belt: user.belt,
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  dueDay: studentMembership.dueDay,
  monthlyFee: studentMembership.monthlyFee,
  trainingNote: user.trainingNote,
  familyId: user.familyId,
  familyName: family.name,
};

// Modalities of each student, sorted by name.
async function modalitiesOf(studentIds: string[]) {
  const byStudent = new Map<string, { id: string; name: string }[]>(studentIds.map((id) => [id, []]));
  if (studentIds.length === 0) {
    return byStudent;
  }
  const rows = await db
    .select({ studentId: studentModality.studentId, id: modality.id, name: modality.name })
    .from(studentModality)
    .innerJoin(modality, eq(modality.id, studentModality.modalityId))
    .where(inArray(studentModality.studentId, studentIds))
    .orderBy(asc(modality.name));
  for (const r of rows) {
    byStudent.get(r.studentId)!.push({ id: r.id, name: r.name });
  }
  return byStudent;
}

export async function isAcademyStudent(id: string, academyId: string) {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, id), eq(user.academyId, academyId), eq(user.role, 'student')));
  return !!row;
}
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { authorizeStudentRead } from '../middleware/student-access.js';

export async function studentRoutes(app: FastifyInstance) {
  // List students with Monthly Fee, modalities and family; ?modalityId= keeps only those who train it.
  app.get('/api/students', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const { modalityId } = request.query as { modalityId?: string };
    if (modalityId !== undefined && !UUID.test(modalityId)) {
      return [];
    }
    const rows = await db
      .select(studentColumns)
      .from(user)
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(family, eq(family.id, user.familyId))
      .where(and(
        eq(user.role, 'student'),
        eq(user.academyId, request.academyId),
        modalityId === undefined
          ? undefined
          : inArray(user.id, db.select({ id: studentModality.studentId }).from(studentModality).where(eq(studentModality.modalityId, modalityId))),
      ));
    const modalities = await modalitiesOf(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, modalities: modalities.get(r.id)! }));
  });

  // Single student profile with membership info
  app.get('/api/students/:id', { preHandler: authorizeStudentRead('id') }, async (request) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .select({
        ...studentColumns,
        image: user.image,
        createdAt: user.createdAt,
        membershipStartDate: studentMembership.startDate,
      })
      .from(user)
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(family, eq(family.id, user.familyId))
      .where(eq(user.id, id));
    return row && { ...row, modalities: (await modalitiesOf([id])).get(id)! };
  });

  // Set the Monthly Fee (owner only); creates the active membership if the student has none.
  app.put('/api/students/:id/membership', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { monthlyFee, dueDay, startDate } = (request.body ?? {}) as { monthlyFee?: unknown; dueDay?: unknown; startDate?: unknown };
    if (typeof monthlyFee !== 'string' || !MONEY.test(monthlyFee)) {
      return reply.status(400).send({ error: 'Invalid monthlyFee' });
    }
    if (dueDay !== undefined && !(Number.isInteger(dueDay) && (dueDay as number) >= 1 && (dueDay as number) <= 28)) {
      return reply.status(400).send({ error: 'dueDay must be 1-28' });
    }
    if (startDate !== undefined && (typeof startDate !== 'string' || !DATE.test(startDate))) {
      return reply.status(400).send({ error: 'startDate must be YYYY-MM-DD' });
    }
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    // Whitelist: only these fields may change.
    const changes = {
      monthlyFee,
      ...(dueDay !== undefined && { dueDay: dueDay as number }),
      ...(startDate !== undefined && { startDate }),
    };
    const [updated] = await db.update(studentMembership)
      .set(changes)
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();
    if (updated) {
      return updated;
    }
    const now = new Date();
    const [created] = await db.insert(studentMembership).values({
      studentId: id,
      dueDay: 8,
      startDate: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
      ...changes,
    }).returning();
    return created;
  });

  // What the student trains: Modalities (replaced as a whole) and the Training Note (owner only).
  // Promotion: owner sets a student's belt (kids or adult, see beltEnum)
  app.put('/api/students/:id/belt', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { belt } = (request.body ?? {}) as { belt?: string };
    if (!belt || !(beltEnum.enumValues as readonly string[]).includes(belt)) {
      return reply.status(400).send({ error: 'Unknown belt' });
    }
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    const [updated] = await db
      .update(user)
      .set({ belt: belt as (typeof beltEnum.enumValues)[number], updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning({ id: user.id, belt: user.belt });
    return updated;
  });

  app.put('/api/students/:id/training', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { modalityIds, trainingNote } = (request.body ?? {}) as { modalityIds?: unknown; trainingNote?: unknown };
    if (!Array.isArray(modalityIds) || !modalityIds.every((m) => typeof m === 'string')) {
      return reply.status(400).send({ error: 'modalityIds must be an array of ids' });
    }
    if (trainingNote !== null && typeof trainingNote !== 'string') {
      return reply.status(400).send({ error: 'trainingNote must be a string or null' });
    }
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    const ids = [...new Set(modalityIds as string[])];
    const found = ids.length > 0 && ids.every((m) => UUID.test(m))
      ? await db.select({ id: modality.id }).from(modality)
        .where(and(inArray(modality.id, ids), eq(modality.academyId, request.academyId)))
      : [];
    if (found.length !== ids.length) {
      return reply.status(404).send({ error: 'Modality not found' });
    }
    const note = trainingNote?.trim() || null;
    await db.transaction(async (tx) => {
      await tx.delete(studentModality).where(eq(studentModality.studentId, id));
      if (ids.length > 0) {
        await tx.insert(studentModality).values(ids.map((modalityId) => ({ studentId: id, modalityId })));
      }
      await tx.update(user).set({ trainingNote: note }).where(eq(user.id, id));
    });
    return { modalities: (await modalitiesOf([id])).get(id)!, trainingNote: note };
  });

  // Waived Months: months a student does not owe (owner only)
  app.get('/api/students/:id/waived-months', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    return db
      .select({ referenceMonth: waivedMonth.referenceMonth, reason: waivedMonth.reason })
      .from(waivedMonth)
      .where(eq(waivedMonth.studentId, id))
      .orderBy(waivedMonth.referenceMonth);
  });

  app.post('/api/students/:id/waived-months', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { month, reason } = (request.body ?? {}) as { month?: unknown; reason?: string | null };
    if (typeof month !== 'string' || !MONTH.test(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    await db
      .insert(waivedMonth)
      .values({ studentId: id, referenceMonth: month, reason: reason ?? null, createdBy: request.user.id })
      .onConflictDoNothing();
    const [row] = await db
      .select({ referenceMonth: waivedMonth.referenceMonth, reason: waivedMonth.reason })
      .from(waivedMonth)
      .where(and(eq(waivedMonth.studentId, id), eq(waivedMonth.referenceMonth, month)));
    return reply.status(201).send(row);
  });

  app.delete('/api/students/:id/waived-months/:month', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id, month } = request.params as { id: string; month: string };
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    await db.delete(waivedMonth).where(and(eq(waivedMonth.studentId, id), eq(waivedMonth.referenceMonth, month)));
    return reply.status(204).send();
  });

  // Toggle notification muting for a student (owner only)
  app.put('/api/students/:id/notifications', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { muted } = request.body as { muted: boolean };
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    const [updated] = await db.update(studentMembership)
      .set({ notificationsMuted: muted })
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Active membership not found' });
    return updated;
  });
}
