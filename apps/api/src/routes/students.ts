import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { user, studentMembership, membershipPlan, family, waivedMonth } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { monthlyFee } from '../billing/rules.js';
import { MONEY, MONTH } from './families.js';

// Family and Monthly Fee fields shared by the list and detail rows.
const feeColumns = {
  familyId: user.familyId,
  familyName: family.name,
  agreedPrice: studentMembership.agreedPrice,
  planPrice: membershipPlan.price,
};

function withMonthlyFee<T extends { planPrice: string | null; agreedPrice: string | null }>(row: T) {
  return { ...row, monthlyFee: row.planPrice === null ? null : monthlyFee(row.planPrice, row.agreedPrice) };
}

async function isAcademyStudent(id: string, academyId: string) {
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
  // List students with their active membership plan name
  app.get('/api/students', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        belt: user.belt,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        planName: membershipPlan.name,
        dueDay: studentMembership.dueDay,
        ...feeColumns,
      })
      .from(user)
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .leftJoin(family, eq(family.id, user.familyId))
      .where(and(eq(user.role, 'student'), eq(user.academyId, request.academyId)));
    return rows.map(withMonthlyFee);
  });

  // Single student profile with membership info
  app.get('/api/students/:id', { preHandler: authorizeStudentRead('id') }, async (request) => {
    const { id } = request.params as { id: string };
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        belt: user.belt,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        image: user.image,
        createdAt: user.createdAt,
        planName: membershipPlan.name,
        planId: studentMembership.planId,
        dueDay: studentMembership.dueDay,
        membershipStartDate: studentMembership.startDate,
        ...feeColumns,
      })
      .from(user)
      .leftJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .leftJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .leftJoin(family, eq(family.id, user.familyId))
      .where(eq(user.id, id));
    return row && withMonthlyFee(row);
  });

  // Assign a plan to a student (owner only)
  app.post('/api/students/:id/membership', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { planId: string; startDate: string; dueDay: number };

    // Deactivate any existing active membership first
    await db.update(studentMembership)
      .set({ active: false })
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)));

    const [created] = await db.insert(studentMembership).values({
      studentId: id,
      planId: body.planId,
      startDate: body.startDate,
      dueDay: body.dueDay,
    }).returning();
    return reply.status(201).send(created);
  });

  // Update active membership (owner only)
  app.put('/api/students/:id/membership', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { planId?: string; dueDay?: number; startDate?: string; agreedPrice?: string | null };
    if (!(await isAcademyStudent(id, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    // Whitelist: only these fields may change.
    const changes: Partial<typeof studentMembership.$inferInsert> = {};
    if (body.planId !== undefined) {
      changes.planId = body.planId;
    }
    if (body.dueDay !== undefined) {
      changes.dueDay = body.dueDay;
    }
    if (body.startDate !== undefined) {
      changes.startDate = body.startDate;
    }
    if (body.agreedPrice !== undefined) {
      if (body.agreedPrice !== null && !MONEY.test(body.agreedPrice)) {
        return reply.status(400).send({ error: 'Invalid agreedPrice' });
      }
      changes.agreedPrice = body.agreedPrice;
    }
    if (Object.keys(changes).length === 0) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }
    const [updated] = await db.update(studentMembership)
      .set(changes)
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();
    if (!updated) {
      return reply.status(404).send({ error: 'Active membership not found' });
    }
    return updated;
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
    const [updated] = await db.update(studentMembership)
      .set({ notificationsMuted: muted })
      .where(and(eq(studentMembership.studentId, id), eq(studentMembership.active, true)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Active membership not found' });
    return updated;
  });
}
