import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, count, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { academy, bjjClass, checkin, payoutLine, payoutSheet, user } from '../db/schema/index.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { loadStudentBilling } from '../billing/load.js';
import { fromCents, memberStatus, monthKey, toCents } from '../billing/rules.js';
import { DEFAULT_ACADEMY_TIMEZONE, startOfDayInTz } from '../utils/timezone.js';
import { money } from './classes.js';
import { MONTH, UUID } from './families.js';
import { shiftMonth } from './finance.js';
import { isAcademyStudent } from './students.js';

const owner = { preHandler: [requireOwner, injectAcademyId] };

type Sheet = Awaited<ReturnType<typeof loadSheets>>[number];

// Class names that get a Payout Sheet (ADR 0007): some class (not a Seminar) with that name has a Class
// Teacher other than the Owner. Classes sharing a name share the sheet and its teachers.
async function payoutClasses(academyId: string) {
  const rows = await db
    .select({
      name: bjjClass.name,
      teacherId: bjjClass.teacherId,
      teacherName: user.name,
      teacherRole: user.role,
      guest: bjjClass.guestTeacherName,
    })
    .from(bjjClass)
    .leftJoin(user, eq(user.id, bjjClass.teacherId))
    .where(and(eq(bjjClass.academyId, academyId), eq(bjjClass.isSeminar, false)));
  const classes = new Map<string, { teachers: Set<string>; teacherIds: Set<string>; paid: boolean }>();
  for (const r of rows) {
    const c = classes.get(r.name) ?? { teachers: new Set(), teacherIds: new Set(), paid: false };
    classes.set(r.name, c);
    const teacher = r.guest ?? r.teacherName;
    if (teacher) {
      c.teachers.add(teacher);
    }
    if (r.teacherId) {
      c.teacherIds.add(r.teacherId);
    }
    if (r.guest || (r.teacherId && r.teacherRole !== 'owner')) {
      c.paid = true;
    }
  }
  return [...classes].filter(([, c]) => c.paid).sort(([a], [b]) => a.localeCompare(b));
}

// Every class name that can have a sheet that month, with its rows: who checked in to those classes plus
// whoever has a line. `listed` = it had check-ins or already has a sheet.
async function loadSheets(academyId: string, month: string) {
  const classes = await payoutClasses(academyId);
  if (classes.length === 0) {
    return [];
  }
  const [acad] = await db.select({ timezone: academy.timezone }).from(academy).where(eq(academy.id, academyId));
  const tz = acad?.timezone ?? DEFAULT_ACADEMY_TIMEZONE;
  const [visits, lines] = await Promise.all([
    db
      .select({ className: bjjClass.name, studentId: checkin.studentId, n: count() })
      .from(checkin)
      .innerJoin(bjjClass, eq(bjjClass.id, checkin.classId))
      .where(
        and(
          eq(bjjClass.academyId, academyId),
          eq(bjjClass.isSeminar, false),
          inArray(
            bjjClass.name,
            classes.map(([name]) => name),
          ),
          gte(checkin.checkedInAt, startOfDayInTz(`${month}-01`, tz)),
          lt(checkin.checkedInAt, startOfDayInTz(`${shiftMonth(month, 1)}-01`, tz)),
        ),
      )
      .groupBy(bjjClass.name, checkin.studentId),
    db
      .select({
        className: payoutSheet.className,
        confirmedAt: payoutSheet.confirmedAt,
        studentId: payoutLine.studentId,
        amount: payoutLine.amount,
        addedByHand: payoutLine.addedByHand,
      })
      .from(payoutSheet)
      .leftJoin(payoutLine, eq(payoutLine.sheetId, payoutSheet.id))
      .where(and(eq(payoutSheet.academyId, academyId), eq(payoutSheet.month, month))),
  ]);
  const ids = [...new Set([...visits, ...lines].flatMap((r) => (r.studentId ? [r.studentId] : [])))];
  const students =
    ids.length === 0 ? [] : await loadStudentBilling(and(inArray(user.id, ids), eq(user.academyId, academyId)));

  return classes.map(([className, c]) => {
    const sheetVisits = visits.filter((v) => v.className === className);
    const sheetLines = lines.filter((l) => l.className === className);
    const rows = students
      .filter((s) => sheetVisits.some((v) => v.studentId === s.studentId) || sheetLines.some((l) => l.studentId === s.studentId))
      .map((s) => {
        const line = sheetLines.find((l) => l.studentId === s.studentId);
        return {
          studentId: s.studentId,
          name: s.name,
          belt: s.belt,
          checkins: sheetVisits.find((v) => v.studentId === s.studentId)?.n ?? 0,
          // Paid, waived or not billed that month: nothing owed.
          paid: memberStatus(s, month) !== 'owed',
          monthlyFee: s.monthlyFee,
          amount: line?.amount ?? null,
          addedByHand: line?.addedByHand ?? false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const typed = rows.filter((r) => r.amount !== null);
    const confirmed = sheetLines.some((l) => l.confirmedAt !== null);
    return {
      className,
      month,
      status: confirmed ? 'confirmed' : typed.length > 0 ? 'draft' : 'empty',
      teachers: [...c.teachers].sort((a, b) => a.localeCompare(b)),
      teacherIds: c.teacherIds,
      listed: sheetVisits.length > 0 || sheetLines.length > 0,
      total: typed.length > 0 ? fromCents(typed.reduce((sum, r) => sum + toCents(r.amount!), 0)) : null,
      rows,
    };
  });
}

// What the Owner sees; teachers never see a Monthly Fee.
function present({ teacherIds: _t, listed: _l, ...sheet }: Sheet, withFee: boolean) {
  return withFee ? sheet : { ...sheet, rows: sheet.rows.map(({ monthlyFee: _f, ...r }) => r) };
}

function lastMonths(n: number) {
  const current = monthKey(new Date());
  return Array.from({ length: n }, (_, i) => shiftMonth(current, -i));
}

// The sheet named in the URL, or undefined once the reply was sent (bad month, no such sheet, confirmed).
async function findSheet(request: FastifyRequest, reply: FastifyReply, writing: boolean) {
  const { month, className } = request.params as { month: string; className: string };
  if (!MONTH.test(month)) {
    reply.status(400).send({ error: 'month must be YYYY-MM' });
    return undefined;
  }
  const sheet = (await loadSheets(request.academyId, month)).find((s) => s.className === className);
  if (!sheet) {
    reply.status(404).send({ error: 'Payout sheet not found' });
    return undefined;
  }
  if (writing && sheet.status === 'confirmed') {
    reply.status(409).send({ error: 'sheetConfirmed' });
    return undefined;
  }
  return sheet;
}

// The sheet's row, created on its first write.
async function saveSheet(academyId: string, sheet: Sheet, changes: { confirmedAt?: Date | null } = {}) {
  const [row] = await db
    .insert(payoutSheet)
    .values({ academyId, className: sheet.className, month: sheet.month, ...changes })
    .onConflictDoUpdate({
      target: [payoutSheet.academyId, payoutSheet.className, payoutSheet.month],
      set: { className: sheet.className, ...changes },
    })
    .returning({ id: payoutSheet.id });
  return row.id;
}

async function reloadRow(academyId: string, sheet: Sheet, studentId: string) {
  const fresh = (await loadSheets(academyId, sheet.month)).find((s) => s.className === sheet.className)!;
  return fresh.rows.find((r) => r.studentId === studentId);
}

export async function payoutSheetRoutes(app: FastifyInstance) {
  app.get('/api/payout-sheets', owner, async (request, reply) => {
    const { month } = request.query as { month?: string };
    if (typeof month !== 'string' || !MONTH.test(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    return (await loadSheets(request.academyId, month))
      .filter((s) => s.listed)
      .map((s) => ({ className: s.className, teachers: s.teachers, students: s.rows.length, total: s.total, status: s.status }));
  });

  // Newest month first. ponytail: recomputes every month's sheets; aggregate if it gets slow.
  app.get('/api/payout-sheets/history', owner, async (request, reply) => {
    const months = Number((request.query as { months?: string }).months ?? 6);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      return reply.status(400).send({ error: 'months must be 1-24' });
    }
    return Promise.all(
      lastMonths(months).map(async (month) => {
        const sheets = (await loadSheets(request.academyId, month)).filter((s) => s.listed);
        return {
          month,
          classes: sheets.map((s) => ({ className: s.className, total: s.total ?? '0.00' })),
          confirmed: sheets.length > 0 && sheets.every((s) => s.status === 'confirmed'),
        };
      }),
    );
  });

  app.get('/api/payout-sheets/:month/:className', owner, async (request, reply) => {
    const sheet = await findSheet(request, reply, false);
    return sheet ? present(sheet, true) : reply;
  });

  // Autosave of one Payout Line; null clears it.
  app.put('/api/payout-sheets/:month/:className/lines/:studentId', owner, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const body = (request.body ?? {}) as { amount?: unknown };
    const amount = body.amount === null ? null : money(body.amount);
    if (body.amount !== null && amount === null) {
      return reply.status(400).send({ error: 'INVALID_AMOUNT' });
    }
    const sheet = await findSheet(request, reply, true);
    if (!sheet) {
      return reply;
    }
    if (!sheet.rows.some((r) => r.studentId === studentId)) {
      return reply.status(404).send({ error: 'Student not on this sheet' });
    }
    const sheetId = await saveSheet(request.academyId, sheet);
    await db
      .insert(payoutLine)
      .values({ sheetId, studentId, amount })
      .onConflictDoUpdate({ target: [payoutLine.sheetId, payoutLine.studentId], set: { amount } });
    return reloadRow(request.academyId, sheet, studentId);
  });

  // Adds a Student who trained without checking in.
  app.post('/api/payout-sheets/:month/:className/lines', owner, async (request, reply) => {
    const { studentId } = (request.body ?? {}) as { studentId?: unknown };
    if (typeof studentId !== 'string' || !UUID.test(studentId) || !(await isAcademyStudent(studentId, request.academyId))) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    const sheet = await findSheet(request, reply, true);
    if (!sheet) {
      return reply;
    }
    const sheetId = await saveSheet(request.academyId, sheet);
    await db.insert(payoutLine).values({ sheetId, studentId, addedByHand: true }).onConflictDoNothing();
    return reply.status(201).send(await reloadRow(request.academyId, sheet, studentId));
  });

  app.delete('/api/payout-sheets/:month/:className/lines/:studentId', owner, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const sheet = await findSheet(request, reply, true);
    if (!sheet) {
      return reply;
    }
    if (!sheet.rows.some((r) => r.studentId === studentId && r.addedByHand)) {
      return reply.status(404).send({ error: 'No line added by hand for this Student' });
    }
    const sheetId = await saveSheet(request.academyId, sheet);
    await db.delete(payoutLine).where(and(eq(payoutLine.sheetId, sheetId), eq(payoutLine.studentId, studentId)));
    return reply.status(204).send();
  });

  for (const [action, confirmedAt] of [
    ['confirm', () => new Date()],
    ['reopen', () => null],
  ] as const) {
    app.post(`/api/payout-sheets/:month/:className/${action}`, owner, async (request, reply) => {
      const sheet = await findSheet(request, reply, false);
      if (!sheet) {
        return reply;
      }
      await saveSheet(request.academyId, sheet, { confirmedAt: confirmedAt() });
      const fresh = (await loadSheets(request.academyId, sheet.month)).find((s) => s.className === sheet.className)!;
      return present(fresh, true);
    });
  }

  // The class names the current profile teaches, with the last 6 months' totals (drafts included).
  app.get('/api/me/payout-sheets', { preHandler: [requireAuth] }, async (request) => {
    const { id, academyId } = request.user;
    if (!academyId) {
      return [];
    }
    const months = lastMonths(6);
    const byMonth = await Promise.all(months.map((month) => loadSheets(academyId, month)));
    return byMonth[0]
      .filter((s) => s.teacherIds.has(id))
      .map((s) => ({
        className: s.className,
        history: months.map((month, i) => {
          const sheet = byMonth[i].find((m) => m.className === s.className)!;
          return { month, total: sheet.total, confirmed: sheet.status === 'confirmed' };
        }),
      }));
  });

  app.get('/api/me/payout-sheets/:month/:className', { preHandler: [requireAuth] }, async (request, reply) => {
    const { month, className } = request.params as { month: string; className: string };
    if (!MONTH.test(month)) {
      return reply.status(400).send({ error: 'month must be YYYY-MM' });
    }
    const { id, academyId } = request.user;
    const sheet = academyId ? (await loadSheets(academyId, month)).find((s) => s.className === className) : undefined;
    if (!sheet?.teacherIds.has(id)) {
      return reply.status(403).send({ error: 'Not a teacher of this class' });
    }
    return present(sheet, false);
  });
}
