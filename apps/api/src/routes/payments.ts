import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { payment, user, studentMembership, membershipPlan, academy } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireInstructor } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { emailService } from '../email/index.js';

export async function paymentRoutes(app: FastifyInstance) {
  // Record a manual payment (instructor only)
  app.post('/api/payments', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const body = request.body as {
      studentId: string;
      amount: string;
      paymentDate: string;
      referenceMonth: string;
    };
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

  // List all payments for an academy
  app.get('/api/payments', async (request) => {
    const { academyId } = request.query as { academyId: string };
    return db.select().from(payment).where(eq(payment.academyId, academyId));
  });

  // Payment status for the current logged-in student
  app.get('/api/payments/my-status', { preHandler: [requireAuth] }, async (request) => {
    const studentId = request.user.id;
    const [membership] = await db
      .select({ dueDay: studentMembership.dueDay })
      .from(studentMembership)
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));
    if (!membership) return { status: 'ok' };

    const now = new Date();
    const currentDay = now.getDate();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [paid] = await db.select({ id: payment.id }).from(payment)
      .where(and(eq(payment.studentId, studentId), eq(payment.referenceMonth, referenceMonth)))
      .limit(1);
    if (paid) return { status: 'ok' };

    if (currentDay > membership.dueDay) {
      return { status: 'overdue', daysOverdue: currentDay - membership.dueDay };
    }
    if (currentDay >= membership.dueDay - 3) {
      return { status: 'upcoming', daysUntilDue: membership.dueDay - currentDay };
    }
    return { status: 'ok' };
  });

  // Payment history for a student
  app.get('/api/payments/student/:studentId', async (request) => {
    const { studentId } = request.params as { studentId: string };
    return db.select().from(payment).where(eq(payment.studentId, studentId));
  });

  // Overdue dashboard
  app.get('/api/payments/overdue', async (request) => {
    const { academyId } = request.query as { academyId: string };

    const now = new Date();
    const currentDay = now.getDate();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all students with active memberships for this academy
    const studentsWithMemberships = await db
      .select({
        studentId: user.id,
        studentName: user.name,
        email: user.email,
        belt: user.belt,
        phone: user.phone,
        notificationsMuted: studentMembership.notificationsMuted,
        planName: membershipPlan.name,
        dueDay: studentMembership.dueDay,
      })
      .from(user)
      .innerJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .innerJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .where(and(eq(user.academyId, academyId), eq(user.role, 'student')));

    // Get all payments for current month
    const monthPayments = await db
      .select({ studentId: payment.studentId })
      .from(payment)
      .where(and(
        eq(payment.academyId, academyId),
        eq(payment.referenceMonth, referenceMonth),
      ));

    const paidStudentIds = new Set(monthPayments.map(p => p.studentId));

    // Filter to students who haven't paid AND current day > their dueDay
    const overdue = studentsWithMemberships
      .filter(s => !paidStudentIds.has(s.studentId) && currentDay > s.dueDay)
      .map(s => ({
        ...s,
        daysOverdue: currentDay - s.dueDay,
        referenceMonth,
      }));

    return overdue;
  });

  // Send overdue payment email notification (instructor only)
  app.post('/api/payments/overdue/:studentId/notify', { preHandler: [requireInstructor, injectAcademyId] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const [student] = await db.select({ email: user.email, name: user.name })
      .from(user).where(eq(user.id, studentId));
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
