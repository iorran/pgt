import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { payment, user, studentMembership, membershipPlan, academy } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { emailService } from '../email/index.js';

export async function paymentRoutes(app: FastifyInstance) {
  // Record a manual payment (owner only)
  app.post('/api/payments', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
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
      .select({ dueDay: studentMembership.dueDay, startDate: studentMembership.startDate })
      .from(studentMembership)
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));
    if (!membership) return { status: 'ok' };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const studentPayments = await db
      .select({ referenceMonth: payment.referenceMonth })
      .from(payment)
      .where(eq(payment.studentId, studentId));
    const paidMonths = new Set(studentPayments.map(p => p.referenceMonth));

    // Walk every month from startDate to current month and find first unpaid overdue
    const start = new Date(membership.startDate);
    let earliestDueDate: Date | null = null;
    for (let y = start.getFullYear(), m = start.getMonth(); y < currentYear || (y === currentYear && m <= currentMonth); ) {
      const refMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!paidMonths.has(refMonth)) {
        const isPastMonth = y < currentYear || (y === currentYear && m < currentMonth);
        const isCurrentMonthPastDueDay = y === currentYear && m === currentMonth && currentDay > membership.dueDay;
        if (isPastMonth || isCurrentMonthPastDueDay) {
          earliestDueDate = new Date(y, m, membership.dueDay);
          break;
        }
      }
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }

    if (earliestDueDate) {
      const daysOverdue = Math.floor((now.getTime() - earliestDueDate.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'overdue', daysOverdue };
    }

    // Not overdue — check upcoming
    const currentRef = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!paidMonths.has(currentRef) && currentDay >= membership.dueDay - 3 && currentDay <= membership.dueDay) {
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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

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
        startDate: studentMembership.startDate,
      })
      .from(user)
      .innerJoin(studentMembership, and(
        eq(studentMembership.studentId, user.id),
        eq(studentMembership.active, true),
      ))
      .innerJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .where(and(eq(user.academyId, academyId), eq(user.role, 'student')));

    // Get all payments for this academy grouped by student + reference month
    const allPayments = await db
      .select({ studentId: payment.studentId, referenceMonth: payment.referenceMonth })
      .from(payment)
      .where(eq(payment.academyId, academyId));

    const paidByStudent = new Map<string, Set<string>>();
    for (const p of allPayments) {
      if (!paidByStudent.has(p.studentId)) paidByStudent.set(p.studentId, new Set());
      paidByStudent.get(p.studentId)!.add(p.referenceMonth);
    }

    // For each student, walk every month from startDate to current and find unpaid past-due months
    const overdue = studentsWithMemberships
      .map(s => {
        const start = new Date(s.startDate);
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const paidMonths = paidByStudent.get(s.studentId) || new Set<string>();

        const missedMonths: string[] = [];
        let earliestDueDate: Date | null = null;

        for (let y = startYear, m = startMonth; y < currentYear || (y === currentYear && m <= currentMonth); ) {
          const refMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
          // Skip if paid
          if (!paidMonths.has(refMonth)) {
            // Determine if this month's due date has already passed
            const isPastMonth = y < currentYear || (y === currentYear && m < currentMonth);
            const isCurrentMonthPastDueDay = y === currentYear && m === currentMonth && currentDay > s.dueDay;
            if (isPastMonth || isCurrentMonthPastDueDay) {
              missedMonths.push(refMonth);
              if (!earliestDueDate) {
                earliestDueDate = new Date(y, m, s.dueDay);
              }
            }
          }
          // Advance one month
          m += 1;
          if (m > 11) { m = 0; y += 1; }
        }

        if (missedMonths.length === 0) return null;

        const daysOverdue = earliestDueDate
          ? Math.floor((now.getTime() - earliestDueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          studentId: s.studentId,
          studentName: s.studentName,
          email: s.email,
          belt: s.belt,
          phone: s.phone,
          notificationsMuted: s.notificationsMuted,
          planName: s.planName,
          dueDay: s.dueDay,
          daysOverdue,
          missedMonths,
          referenceMonth: missedMonths[missedMonths.length - 1],
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return overdue;
  });

  // Quick payment for the current month (owner only)
  app.post('/api/payments/quick/:studentId', { preHandler: [requireOwner, injectAcademyId] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    // Get the student's active membership and plan price
    const [membership] = await db
      .select({
        planId: studentMembership.planId,
        price: membershipPlan.price,
      })
      .from(studentMembership)
      .innerJoin(membershipPlan, eq(membershipPlan.id, studentMembership.planId))
      .where(and(eq(studentMembership.studentId, studentId), eq(studentMembership.active, true)));

    if (!membership) {
      return reply.status(404).send({ error: 'Active membership not found' });
    }

    const now = new Date();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paymentDate = now.toISOString().split('T')[0];

    const [created] = await db.insert(payment).values({
      studentId,
      academyId: request.academyId,
      amount: membership.price,
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
