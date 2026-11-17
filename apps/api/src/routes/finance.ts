import { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bjjClass, expense, payment, payoutLine, payoutSheet, seminarParticipant } from '../db/schema/index.js';
import { requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { fromCents, monthKey, toCents } from '../billing/rules.js';
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

// Monthly Balance: money paid that month − that month's Expenses − its confirmed Payout Sheets.
// Draft sheets are only pending.
async function balanceFor(academyId: string, month: string) {
  const [paid, seminars, expenses, lines] = await Promise.all([
    db
      .select({ studentId: payment.studentId, amount: payment.amount })
      .from(payment)
      .where(and(eq(payment.academyId, academyId), paidIn(month))),
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
    db
      .select({ amount: payoutLine.amount, confirmedAt: payoutSheet.confirmedAt })
      .from(payoutLine)
      .innerJoin(payoutSheet, eq(payoutSheet.id, payoutLine.sheetId))
      .where(and(eq(payoutSheet.academyId, academyId), eq(payoutSheet.month, month))),
  ]);
  const sum = (rows: { amount: string | null }[]) => rows.reduce((total, r) => total + toCents(r.amount ?? '0'), 0);
  const incomeCents = sum(paid) + sum(seminars);
  const expenseCents = sum(expenses);
  const payoutCents = sum(lines.filter((l) => l.confirmedAt !== null));
  const pendingCents = sum(lines.filter((l) => l.confirmedAt === null));
  return {
    month,
    income: {
      monthlyFees: {
        amount: fromCents(sum(paid)),
        students: new Set(paid.map((p) => p.studentId)).size,
      },
      seminars: {
        amount: fromCents(sum(seminars)),
        count: new Set(seminars.map((s) => s.classId)).size,
      },
      total: fromCents(incomeCents),
    },
    expenses: { total: fromCents(expenseCents), items: expenses },
    payouts: { total: fromCents(payoutCents), pending: fromCents(pendingCents) },
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
