import { FastifyInstance } from 'fastify';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, type SQL } from 'drizzle-orm';
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
  teacherAgreement,
  agreementTeacher,
  user,
} from '../db/schema/index.js';
import { teachersOf } from './agreements.js';
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

// Check-ins per Student that month in classes taught by any teacher of the agreement (academy timezone).
export async function checkinsWith(agreementId: string, studentIds: string[], month: string, tz: string) {
  const counts = new Map(studentIds.map((id) => [id, 0]));
  if (studentIds.length === 0) {
    return counts;
  }
  const rows = await agreementCheckins(agreementId, month, tz, inArray(checkin.studentId, studentIds));
  for (const r of rows) {
    counts.set(r.studentId, r.n);
  }
  return counts;
}

function agreementCheckins(agreementId: string, month: string, tz: string, where?: SQL) {
  return db
    .select({ studentId: checkin.studentId, name: user.name, n: count() })
    .from(checkin)
    .innerJoin(bjjClass, eq(bjjClass.id, checkin.classId))
    .innerJoin(agreementTeacher, and(eq(agreementTeacher.teacherId, bjjClass.teacherId), eq(agreementTeacher.agreementId, agreementId)))
    .innerJoin(user, eq(user.id, checkin.studentId))
    .where(
      and(
        gte(checkin.checkedInAt, startOfDayInTz(`${month}-01`, tz)),
        lt(checkin.checkedInAt, startOfDayInTz(`${shiftMonth(month, 1)}-01`, tz)),
        where,
      ),
    )
    .groupBy(checkin.studentId, user.name, user.createdAt)
    .orderBy(asc(user.createdAt), asc(checkin.studentId));
}

async function loadAcademy(academyId: string) {
  const [row] = await db.select().from(academy).where(eq(academy.id, academyId));
  return row;
}

// Teacher Payouts of a month: one per Teacher Agreement that is active with linked Students, or has a
// confirmed amount that month. The agreement's percentage applies to each add-on payment's add-on price
// and to what Recruited Students paid (their Monthly Fee: a Student links to one agreement only).
// ponytail: links are current, so past months are computed with today's links and prices.
export async function payoutsFor(academyId: string, month: string) {
  const acad = await loadAcademy(academyId);
  const [agreements, linked, confirmedRows] = await Promise.all([
    db
      .select()
      .from(teacherAgreement)
      .where(eq(teacherAgreement.academyId, academyId))
      .orderBy(asc(teacherAgreement.createdAt), asc(teacherAgreement.id)),
    db
      .select({
        id: user.id,
        name: user.name,
        agreementId: user.agreementId,
        kind: user.agreementKind,
        monthlyFee: studentMembership.monthlyFee,
      })
      .from(user)
      .leftJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
      .where(and(eq(user.academyId, academyId), eq(user.role, 'student'), isNotNull(user.agreementId)))
      .orderBy(user.createdAt, user.id),
    db
      .select()
      .from(teacherPayout)
      .where(and(eq(teacherPayout.academyId, academyId), eq(teacherPayout.month, month))),
  ]);
  const shown = agreements.filter(
    (a) =>
      (a.active && linked.some((s) => s.agreementId === a.id)) || confirmedRows.some((p) => p.agreementId === a.id),
  );
  if (shown.length === 0) {
    return [];
  }
  const [teachers, payments] = await Promise.all([
    teachersOf(shown.map((a) => a.id)),
    linked.length === 0
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
                linked.map((s) => s.id),
              ),
              paidIn(month),
            ),
          )
          .orderBy(payment.paymentDate, payment.referenceMonth),
  ]);

  return Promise.all(
    shown.map(async (a) => {
      const students = linked.filter((s) => s.agreementId === a.id);
      const teacherIds = new Set(teachers.get(a.id)!.map((t) => t.id));
      const [checkins, visits] = await Promise.all([
        checkinsWith(
          a.id,
          students.map((s) => s.id),
          month,
          acad.timezone,
        ),
        agreementCheckins(a.id, month, acad.timezone),
      ]);
      const percent = a.sharePercent;
      const priceCents = a.addOnPrice === null ? 0 : toCents(a.addOnPrice);
      const shareCents = Math.round((priceCents * percent) / 100);
      const entries = students.map((s) => {
        const rows = payments
          .filter((p) => p.studentId === s.id)
          .map(({ studentId: _s, ...p }) => ({
            ...p,
            payout: s.kind === 'addOn' ? shareCents : Math.round((toCents(p.amount) * percent) / 100),
          }));
        return {
          studentId: s.id,
          name: s.name,
          kind: s.kind!,
          monthlyFee: s.monthlyFee,
          checkins: checkins.get(s.id)!,
          paidCents: rows.reduce((sum, p) => sum + toCents(p.amount), 0),
          payoutCents: rows.reduce((sum, p) => sum + p.payout, 0),
          payments: rows.map((p) => ({ ...p, payout: fromCents(p.payout) })),
        };
      });
      const addOnPaid = entries.filter((e) => e.kind === 'addOn').reduce((n, e) => n + e.payments.length, 0);
      const recruitedEntries = entries.filter((e) => e.kind === 'recruited');
      const recruitedCents = recruitedEntries.reduce((sum, e) => sum + e.payoutCents, 0);
      const suggested = fromCents(addOnPaid * shareCents + recruitedCents);
      const confirmed = confirmedRows.find((p) => p.agreementId === a.id)?.amount ?? null;
      const linkedIds = new Set(students.map((s) => s.id));
      return {
        agreement: { id: a.id, name: a.name, sharePercent: percent, active: a.active, teachers: teachers.get(a.id)! },
        addOn: {
          count: addOnPaid,
          price: a.addOnPrice,
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
        // Check-ins never set the money; they only flag add-on Students who didn't come...
        missingCheckins: entries.filter((e) => e.kind === 'addOn' && e.checkins === 0).map((e) => e.name),
        // ...and Students who came without being linked (the Owner decides whether to link them).
        walkIns: visits
          .filter((v) => !linkedIds.has(v.studentId) && !teacherIds.has(v.studentId))
          .map((v) => ({ studentId: v.studentId, name: v.name, checkins: v.n })),
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
// ponytail: the add-on part of past payments uses today's links and add-on prices.
async function balanceFor(academyId: string, month: string) {
  const [paid, addOnStudents, seminars, expenses, payouts] = await Promise.all([
    db
      .select({ studentId: payment.studentId, amount: payment.amount })
      .from(payment)
      .where(and(eq(payment.academyId, academyId), paidIn(month))),
    db
      .select({ id: user.id, price: teacherAgreement.addOnPrice })
      .from(user)
      .innerJoin(teacherAgreement, eq(teacherAgreement.id, user.agreementId))
      .where(and(eq(user.academyId, academyId), eq(user.agreementKind, 'addOn'))),
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
  const addOnPrice = new Map(addOnStudents.map((s) => [s.id, toCents(s.price ?? '0')]));
  const sum = (rows: { amount: string }[]) => rows.reduce((total, r) => total + toCents(r.amount), 0);
  const addOnPaid = paid.filter((p) => addOnPrice.has(p.studentId));
  const addOnCount = addOnPaid.length;
  const addOnCents = addOnPaid.reduce((total, p) => total + addOnPrice.get(p.studentId)!, 0);
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
    const agreementId = typeof body.agreementId === 'string' && UUID.test(body.agreementId) ? body.agreementId : null;
    const [agreement] = agreementId
      ? await db
          .select({ id: teacherAgreement.id })
          .from(teacherAgreement)
          .where(and(eq(teacherAgreement.id, agreementId), eq(teacherAgreement.academyId, request.academyId)))
      : [];
    if (!agreement) {
      return reply.status(400).send({ error: 'INVALID_PAYOUT_AGREEMENT' });
    }
    const [saved] = await db
      .insert(teacherPayout)
      .values({
        academyId: request.academyId,
        agreementId: agreement.id,
        month: body.month,
        amount,
      })
      .onConflictDoUpdate({
        target: [teacherPayout.agreementId, teacherPayout.month],
        set: { amount, confirmedAt: new Date() },
      })
      .returning({
        agreementId: teacherPayout.agreementId,
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
