import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { payment, user, studentMembership, academy, family } from '../db/schema/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { authorizeStudentRead } from '../middleware/student-access.js';
import { emailService } from '../email/index.js';
import { isAcademyStudent } from './students.js';
import { loadStudentBilling } from '../billing/load.js';
import { daysOverdue, familyBilling, fromCents, monthKey, owedMonths, toCents } from '../billing/rules.js';

export async function paymentRoutes(app: FastifyInstance) {
  // Record a manual payment (owner only)
  app.post('/api/payments', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const body = request.body as {
      studentId: string;
      amount: string;
      paymentDate: string;
      referenceMonth: string;
    };
    if (!(await isAcademyStudent(body.studentId, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    const [created] = await db.insert(payment).values({
      studentId: body.studentId,
      academyId: request.academyId,
      amount: body.amount,
      paymentDate: body.paymentDate,
      referenceMonth: body.referenceMonth,
      recordedBy: request.user.id,
    }).returning();
    return reply.status(201).send(created);
  });

  // List all payments for the owner's academy
  app.get('/api/payments', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    return db.select().from(payment).where(eq(payment.academyId, request.academyId));
  });

  // Payment status for the current logged-in student
  app.get('/api/payments/my-status', { preHandler: [requireAuth] }, async (request) => {
    const [student] = await loadStudentBilling(eq(user.id, request.user.id));
    const membership = student?.membership;
    // No active membership, or a free Monthly Fee: nothing to pay.
    if (!membership || toCents(membership.fee) <= 0) {
      return { status: 'ok' };
    }

    const now = new Date();
    const owed = owedMonths(student, now);
    if (owed.length > 0) {
      return { status: 'overdue', daysOverdue: daysOverdue(owed[0], membership.dueDay, now) };
    }

    // Not overdue — check upcoming
    const currentRef = monthKey(now);
    const currentDay = now.getDate();
    const settled = student.paid.has(currentRef) || student.waived.has(currentRef);
    if (!settled && currentDay >= membership.dueDay - 3 && currentDay <= membership.dueDay) {
      return { status: 'upcoming', daysUntilDue: membership.dueDay - currentDay };
    }

    return { status: 'ok' };
  });

  // Payment history for a student
  app.get('/api/payments/student/:studentId', { preHandler: authorizeStudentRead('studentId') }, async (request) => {
    const { studentId } = request.params as { studentId: string };
    return db.select().from(payment).where(eq(payment.studentId, studentId));
  });

  // Overdue dashboard: one item per student, family members grouped into one family item.
  app.get('/api/payments/overdue', { preHandler: [requireOwner, injectAcademyId] }, async (request) => {
    const now = new Date();
    const [students, families] = await Promise.all([
      loadStudentBilling(eq(user.academyId, request.academyId)),
      db.select().from(family).where(and(eq(family.academyId, request.academyId), isNull(family.deletedAt))),
    ]);

    const items: ({ daysOverdue: number } & Record<string, unknown>)[] = [];
    const familyIds = new Set(families.map((f) => f.id));
    for (const s of students) {
      if (s.familyId && familyIds.has(s.familyId)) {
        continue;
      }
      const owed = owedMonths(s, now);
      if (owed.length === 0) {
        continue;
      }
      items.push({
        kind: 'student',
        studentId: s.studentId,
        studentName: s.name,
        email: s.email,
        belt: s.belt,
        phone: s.phone,
        notificationsMuted: s.notificationsMuted,
        dueDay: s.dueDay,
        daysOverdue: daysOverdue(owed[0], s.membership!.dueDay, now),
        missedMonths: owed,
        referenceMonth: owed[owed.length - 1],
        amountDue: fromCents(toCents(s.membership!.fee) * owed.length),
      });
    }

    for (const f of families) {
      const members = students.filter((s) => s.familyId === f.id);
      const billing = familyBilling(f.agreedPrice, members, now);
      if (billing.suggestedMonths.length === 0) {
        continue;
      }
      const days = members.flatMap((m) => {
        const owed = owedMonths(m, now);
        return owed.length > 0 ? [daysOverdue(owed[0], m.membership!.dueDay, now)] : [];
      });
      const contact = members.find((m) => m.studentId === f.contactStudentId && m.phone);
      items.push({
        kind: 'family',
        familyId: f.id,
        familyName: f.name,
        members: members.map((m) => ({ studentId: m.studentId, name: m.name })),
        phone: (contact ?? members.find((m) => m.phone))?.phone ?? null,
        daysOverdue: Math.max(...days),
        missedMonths: billing.suggestedMonths,
        amountDue: billing.suggestedAmount,
      });
    }

    return items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  });

  // Quick payment for the current month (owner only)
  app.post('/api/payments/quick/:studentId', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    // Get the student's active membership and Monthly Fee
    const [membership] = await db
      .select({ monthlyFee: studentMembership.monthlyFee })
      .from(studentMembership)
      .innerJoin(user, eq(user.id, studentMembership.studentId))
      .where(and(
        eq(studentMembership.studentId, studentId),
        eq(studentMembership.active, true),
        eq(user.academyId, request.academyId),
      ));

    if (!membership) {
      return reply.status(404).send({ error: 'Active membership not found' });
    }

    const now = new Date();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paymentDate = now.toISOString().split('T')[0];

    const [created] = await db.insert(payment).values({
      studentId,
      academyId: request.academyId,
      amount: membership.monthlyFee,
      paymentDate,
      referenceMonth,
      recordedBy: request.user.id,
    }).returning();

    return reply.status(201).send(created);
  });

  // Send overdue payment email notification (owner only)
  app.post('/api/payments/overdue/:studentId/notify', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const [student] = await db.select({ email: user.email, name: user.name })
      .from(user).where(and(eq(user.id, studentId), eq(user.academyId, request.academyId)));
    if (!student) return reply.status(404).send({ error: 'Student not found' });

    const [acad] = await db.select({ name: academy.name })
      .from(academy).where(eq(academy.id, request.academyId));

    const now = new Date();
    const currentDay = now.getDate();
    const [membership] = await db.select({ dueDay: studentMembership.dueDay })
      .from(studentMembership)
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    const daysOverdue = membership ? currentDay - membership.dueDay : 0;
    await emailService.sendOverduePayment(student.email, student.name, acad?.name || 'PGT', daysOverdue);

    await db.update(studentMembership)
      .set({ lastOverdueEmailSentAt: now })
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    return { sent: true };
  });
}
