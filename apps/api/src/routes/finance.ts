import { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  academy,
  bjjClass,
  checkin,
  expense,
  payment,
  seminarParticipant,
  studentMembership,
  teacherPayout,
  user,
} from '../db/schema/index.js';
import { requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { fromCents, monthKey, toCents } from '../billing/rules.js';
import { startOfDayInTz } from '../utils/timezone.js';
import { money } from './classes.js';
import { MONTH, UUID } from './families.js';

const owner = { preHandler: [requireOwner, injectAcademyId] };

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

// Payments count in the month they were paid (payment_date), whatever month they refer to.
const paidIn = (month: string) =>
  and(gte(payment.paymentDate, `${month}-01`), lt(payment.paymentDate, `${shiftMonth(month, 1)}-01`));

// Check-ins per Student that month in classes taught by `teacherId` (academy timezone).
export async function checkinsWith(teacherId: string, studentIds: string[], month: string, tz: string) {
  const counts = new Map(studentIds.map((id) => [id, 0]));
  if (studentIds.length === 0) {
    return counts;
  }
  const rows = await db
    .select({ studentId: checkin.studentId, n: count() })
    .from(checkin)
    .innerJoin(bjjClass, eq(bjjClass.id, checkin.classId))
    .where(
      and(
        eq(bjjClass.teacherId, teacherId),
        inArray(checkin.studentId, studentIds),
        gte(checkin.checkedInAt, startOfDayInTz(`${month}-01`, tz)),
        lt(checkin.checkedInAt, startOfDayInTz(`${shiftMonth(month, 1)}-01`, tz)),
      ),
    )
    .groupBy(checkin.studentId);
  for (const r of rows) {
    counts.set(r.studentId, r.n);
  }
  return counts;
}

async function loadAcademy(academyId: string) {
  const [row] = await db.select().from(academy).where(eq(academy.id, academyId));
  return row;
}

// Teacher Payouts of a month: one per Payout Teacher with marked Students or a confirmed amount.
// ponytail: marks are current flags, so past months are computed with today's marks and settings.
export async function payoutsFor(academyId: string, month: string) {
  const acad = await loadAcademy(academyId);
  const [marked, confirmedRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        addOnTeacherId: user.addOnTeacherId,
        recruitedById: user.recruitedById,
        monthlyFee: studentMembership.monthlyFee,
      })
      .from(user)
      .leftJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
      .where(
        and(
          eq(user.academyId, academyId),
          eq(user.role, 'student'),
          or(isNotNull(user.addOnTeacherId), isNotNull(user.recruitedById)),
        ),
      )
      .orderBy(user.createdAt, user.id),
    db
      .select()
      .from(teacherPayout)
      .where(and(eq(teacherPayout.academyId, academyId), eq(teacherPayout.month, month))),
  ]);
  const teacherIds = [
    ...new Set([
      ...marked.flatMap((s) => [s.addOnTeacherId, s.recruitedById].filter((id): id is string => !!id)),
      ...confirmedRows.map((p) => p.teacherId),
    ]),
  ];
  if (teacherIds.length === 0) {
    return [];
  }
  const [teachers, payments] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, teacherIds)).orderBy(asc(user.name)),
    marked.length === 0
      ? []
      : db
          .select({
            studentId: payment.studentId,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            referenceMonth: payment.referenceMonth,
          })
          .from(payment)
          .where(
            and(
              eq(payment.academyId, academyId),
              inArray(
                payment.studentId,
                marked.map((s) => s.id),
              ),
              paidIn(month),
            ),
          )
          .orderBy(payment.paymentDate, payment.referenceMonth),
  ]);
  const shareCents = toCents(acad.addOnTeacherShare);
  const percent = acad.recruitedSharePercent;

  return Promise.all(
    teachers.map(async (t) => {
      const addOnStudents = marked.filter((s) => s.addOnTeacherId === t.id);
      const recruited = marked.filter((s) => s.recruitedById === t.id);
      const checkins = await checkinsWith(
        t.id,
        addOnStudents.map((s) => s.id),
        month,
        acad.timezone,
      );
      const entry = (s: (typeof marked)[number], kind: 'addOn' | 'recruited') => {
        const rows = payments
          .filter((p) => p.studentId === s.id)
          .map(({ studentId: _s, ...p }) => ({
            ...p,
            payout: kind === 'addOn' ? shareCents : Math.round((toCents(p.amount) * percent) / 100),
          }));
        return {
          studentId: s.id,
          name: s.name,
          kind,
          monthlyFee: s.monthlyFee,
          checkins: kind === 'addOn' ? checkins.get(s.id)! : null,
          paidCents: rows.reduce((sum, p) => sum + toCents(p.amount), 0),
          payoutCents: rows.reduce((sum, p) => sum + p.payout, 0),
          payments: rows.map((p) => ({ ...p, payout: fromCents(p.payout) })),
        };
      };
      const entries = [...addOnStudents.map((s) => entry(s, 'addOn')), ...recruited.map((s) => entry(s, 'recruited'))];
      const addOnPaid = entries.filter((e) => e.kind === 'addOn').reduce((n, e) => n + e.payments.length, 0);
      const recruitedEntries = entries.filter((e) => e.kind === 'recruited');
      const recruitedCents = recruitedEntries.reduce((sum, e) => sum + e.payoutCents, 0);
      const suggested = fromCents(addOnPaid * shareCents + recruitedCents);
      const confirmed = confirmedRows.find((p) => p.teacherId === t.id)?.amount ?? null;
      return {
        teacher: t,
        addOn: {
          count: addOnPaid,
          share: fromCents(shareCents),
          amount: fromCents(addOnPaid * shareCents),
        },
        recruited: {
          paid: fromCents(recruitedEntries.reduce((sum, e) => sum + e.paidCents, 0)),
          percent,
          amount: fromCents(recruitedCents),
        },
        suggested,
        confirmed,
        amount: confirmed ?? suggested,
        // Check-ins never set the add-on; they only flag marked Students who didn't come.
        missingCheckins: entries.filter((e) => e.checkins === 0).map((e) => e.name),
        students: entries.map(({ paidCents, payoutCents, ...e }) => ({
          ...e,
          paid: fromCents(paidCents),
          payout: fromCents(payoutCents),
        })),
      };
    }),
  );
}

// Monthly Balance: money paid that month − that month's Expenses − Teacher Payouts.
// ponytail: the add-on part of past payments uses today's marks and add-on price.
async function balanceFor(academyId: string, month: string) {
  const acad = await loadAcademy(academyId);
  const [paid, addOnStudents, seminars, expenses, payouts] = await Promise.all([
    db
      .select({ studentId: payment.studentId, amount: payment.amount })
      .from(payment)
      .where(and(eq(payment.academyId, academyId), paidIn(month))),
    db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.academyId, academyId), isNotNull(user.addOnTeacherId))),
    db
      .select({
        classId: seminarParticipant.classId,
        amount: seminarParticipant.amount,
      })
      .from(seminarParticipant)
      .innerJoin(bjjClass, eq(bjjClass.id, seminarParticipant.classId))
      .where(
        and(
          eq(bjjClass.academyId, academyId),
          gte(seminarParticipant.paidAt, `${month}-01`),
          lt(seminarParticipant.paidAt, `${shiftMonth(month, 1)}-01`),
        ),
      ),
    db
      .select({ description: expense.description, amount: expense.amount })
      .from(expense)
      .where(and(eq(expense.academyId, academyId), eq(expense.month, month)))
      .orderBy(desc(expense.amount)),
    payoutsFor(academyId, month),
  ]);
  const addOnIds = new Set(addOnStudents.map((s) => s.id));
  const sum = (rows: { amount: string }[]) => rows.reduce((total, r) => total + toCents(r.amount), 0);
  const addOnCount = paid.filter((p) => addOnIds.has(p.studentId)).length;
  const addOnCents = addOnCount * toCents(acad.addOnPrice);
  const incomeCents = sum(paid) + sum(seminars);
  const expenseCents = sum(expenses);
  const payoutCents = sum(payouts);
  return {
    month,
    income: {
      monthlyFees: {
        amount: fromCents(sum(paid) - addOnCents),
        students: new Set(paid.map((p) => p.studentId)).size,
      },
      addOns: { amount: fromCents(addOnCents), count: addOnCount },
      seminars: {
        amount: fromCents(sum(seminars)),
        count: new Set(seminars.map((s) => s.classId)).size,
      },
      total: fromCents(incomeCents),
    },
    expenses: { total: fromCents(expenseCents), items: expenses },
    payouts: { total: fromCents(payoutCents) },
    result: fromCents(incomeCents - expenseCents - payoutCents),
  };
}

const expenseColumns = {
  id: expense.id,
  description: expense.description,
  amount: expense.amount,
  oneOff: expense.oneOff,
  confirmed: expense.confirmed,
};

function listExpenses(academyId: string, month: string) {
  return db
    .select(expenseColumns)
    .from(expense)
    .where(and(eq(expense.academyId, academyId), eq(expense.month, month)))
    .orderBy(expense.createdAt, expense.id);
}

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH.test(value);
}

export async function financeRoutes(app: FastifyInstance) {
  app.put('/api/finance/settings', owner, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const addOnName = typeof body.addOnName === 'string' ? body.addOnName.trim() : '';
    const addOnPrice = money(body.addOnPrice);
    const addOnTeacherShare = money(body.addOnTeacherShare);
    const percent = body.recruitedSharePercent;
    const validPercent = Number.isInteger(percent) && (percent as number) >= 0 && (percent as number) <= 100;
    if (
      !addOnName ||
      addOnName.length > 50 ||
      addOnPrice === null ||
      addOnTeacherShare === null ||
      toCents(addOnTeacherShare) > toCents(addOnPrice) ||
      !validPercent
    ) {
      return reply.status(400).send({ error: 'INVALID_FINANCE_SETTINGS' });
    }
    const [updated] = await db
      .update(academy)
      .set({
        addOnName,
        addOnPrice,
        addOnTeacherShare,
        recruitedSharePercent: percent as number,
      })
      .where(eq(academy.id, request.academyId))
      .returning({
        addOnName: academy.addOnName,
        addOnPrice: academy.addOnPrice,
        addOnTeacherShare: academy.addOnTeacherShare,
        recruitedSharePercent: academy.recruitedSharePercent,
      });
    return updated;
  });

  // A month's Expenses. An empty month starts from the latest earlier month's list (not its one-off rows).
  // ponytail: "empty" is the trigger, so a month whose rows were all removed is filled again when reopened.
  app.get('/api/finance/expenses', owner, async (request, reply) => {
    const { month } = request.query as { month?: string };
    if (!validMonth(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    let rows = await listExpenses(request.academyId, month);
    if (rows.length === 0) {
      const [previous] = await db
        .select({ month: expense.month })
        .from(expense)
        .where(and(eq(expense.academyId, request.academyId), lt(expense.month, month)))
        .orderBy(desc(expense.month))
        .limit(1);
      const source = previous ? (await listExpenses(request.academyId, previous.month)).filter((e) => !e.oneOff) : [];
      if (source.length > 0) {
        const now = Date.now();
        await db.insert(expense).values(
          source.map((e, i) => ({
            academyId: request.academyId,
            month,
            description: e.description,
            amount: e.amount,
            confirmed: false,
            // Keeps the copied order.
            createdAt: new Date(now + i),
          })),
        );
        rows = await listExpenses(request.academyId, month);
      }
    }
    return { month, expenses: rows };
  });

  app.post('/api/finance/expenses', owner, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = money(body.amount);
    if (!validMonth(body.month) || !description || description.length > 255 || amount === null) {
      return reply.status(400).send({ error: 'INVALID_EXPENSE' });
    }
    const [created] = await db
      .insert(expense)
      .values({
        academyId: request.academyId,
        month: body.month,
        description,
        amount,
        oneOff: body.oneOff === true,
      })
      .returning(expenseColumns);
    return reply.status(201).send(created);
  });

  // Edits a row; saving also confirms a copied value.
  app.put('/api/finance/expenses/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const changes: Partial<typeof expense.$inferInsert> = { confirmed: true };
    if (body.amount !== undefined) {
      const amount = money(body.amount);
      if (amount === null) {
        return reply.status(400).send({ error: 'INVALID_EXPENSE' });
      }
      changes.amount = amount;
    }
    if (body.description !== undefined) {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!description || description.length > 255) {
        return reply.status(400).send({ error: 'INVALID_EXPENSE' });
      }
      changes.description = description;
    }
    const [updated] = UUID.test(id)
      ? await db
          .update(expense)
          .set(changes)
          .where(and(eq(expense.id, id), eq(expense.academyId, request.academyId)))
          .returning(expenseColumns)
      : [];
    if (!updated) {
      return reply.status(404).send({ error: 'EXPENSE_NOT_FOUND' });
    }
    return updated;
  });

  app.delete('/api/finance/expenses/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = UUID.test(id)
      ? await db
          .delete(expense)
          .where(and(eq(expense.id, id), eq(expense.academyId, request.academyId)))
          .returning({ id: expense.id })
      : [];
    if (!deleted) {
      return reply.status(404).send({ error: 'EXPENSE_NOT_FOUND' });
    }
    return reply.status(204).send();
  });

  app.get('/api/finance/payouts', owner, async (request, reply) => {
    const { month } = request.query as { month?: string };
    if (!validMonth(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    return payoutsFor(request.academyId, month);
  });

  // The Owner confirms a Teacher Payout, possibly with a corrected amount.
  app.post('/api/finance/payouts', owner, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const amount = money(body.amount);
    if (!validMonth(body.month) || amount === null) {
      return reply.status(400).send({ error: 'INVALID_PAYOUT' });
    }
    const teacherId = typeof body.teacherId === 'string' && UUID.test(body.teacherId) ? body.teacherId : null;
    const [teacher] = teacherId
      ? await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, teacherId), eq(user.academyId, request.academyId)))
      : [];
    if (!teacher) {
      return reply.status(400).send({ error: 'INVALID_PAYOUT_TEACHER' });
    }
    const [saved] = await db
      .insert(teacherPayout)
      .values({
        academyId: request.academyId,
        teacherId: teacher.id,
        month: body.month,
        amount,
      })
      .onConflictDoUpdate({
        target: [teacherPayout.academyId, teacherPayout.teacherId, teacherPayout.month],
        set: { amount, confirmedAt: new Date() },
      })
      .returning({
        teacherId: teacherPayout.teacherId,
        month: teacherPayout.month,
        amount: teacherPayout.amount,
      });
    return saved;
  });

  // The Monthly Balance plus the results of the 6 months up to it.
  // ponytail: recomputes each month (a handful of queries each); cache or aggregate if it gets slow.
  app.get('/api/finance/balance', owner, async (request, reply) => {
    const { month } = request.query as { month?: string };
    if (!validMonth(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    const months = [5, 4, 3, 2, 1, 0].map((n) => shiftMonth(month, -n));
    const balances = await Promise.all(months.map((m) => balanceFor(request.academyId, m)));
    return {
      ...balances[5],
      history: balances.map((b) => ({ month: b.month, result: b.result })),
    };
  });
}
