import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { account, family, familyPayment, familySuggestionDismissal, payment, user } from '../db/schema/index.js';
import { and, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { requireOwner } from '../middleware/auth.js';
import { auth } from '../auth/index.js';
import { env } from '../env.js';
import { injectAcademyId } from '../middleware/tenant.js';
import { loadStudentBilling, type StudentBilling } from '../billing/load.js';
import { dateKey, familyBilling, familyFee, memberStatus, monthKey, splitFamilyPayment } from '../billing/rules.js';

export const MONEY = /^\d+(\.\d{1,2})?$/;
export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
// Where invite/first-access links land: the web app (prod/staging serve the API behind it).
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || env.BETTER_AUTH_URL;

type Responsible = { id: string; name: string; email: string; phone: string | null; trains: boolean };
type NewResponsible = { name: string; email: string };

class EmailTakenError extends Error {
  constructor() {
    super('EMAIL_TAKEN');
  }
}

function parseNewResponsible(value: unknown): NewResponsible | null {
  const v = value as Partial<NewResponsible> | null;
  if (!v || typeof v.name !== 'string' || !v.name.trim() || typeof v.email !== 'string' || !EMAIL.test(v.email.trim())) {
    return null;
  }
  return { name: v.name.trim(), email: v.email.trim().toLowerCase() };
}

async function emailTaken(email: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  return !!row;
}

// A Responsible who doesn't train: login only, never a member (ADR 0004).
async function createResponsible(tx: Pick<typeof db, 'insert'>, academyId: string, r: NewResponsible) {
  if (await emailTaken(r.email)) {
    throw new EmailTakenError();
  }
  const [row] = await tx
    .insert(user)
    .values({ academyId, name: r.name, email: r.email, role: 'responsible', status: 'active' })
    .returning({ id: user.id });
  return row.id;
}

type FamilyRow = typeof family.$inferSelect;

class StudentInFamilyError extends Error {
  constructor(public studentIds: string[]) {
    super('STUDENT_IN_FAMILY');
  }
}

export function buildFamily(fam: FamilyRow, members: StudentBilling[], today: Date, responsible: Responsible | null = null) {
  return {
    id: fam.id,
    name: fam.name,
    responsible,
    agreedPrice: fam.agreedPrice,
    priceReviewNeeded: fam.priceReviewNeeded !== null,
    familyFee: familyFee(fam.agreedPrice, members, monthKey(today)),
    members: members.map((m) => ({
      id: m.studentId,
      name: m.name,
      phone: m.phone,
      belt: m.belt,
      monthlyFee: m.membership?.fee ?? null,
    })),
  };
}

async function findFamily(id: string, academyId: string) {
  const [fam] = await db
    .select()
    .from(family)
    .where(and(eq(family.id, id), eq(family.academyId, academyId), isNull(family.deletedAt)));
  return fam;
}

async function loadResponsible(fam: FamilyRow): Promise<Responsible | null> {
  if (!fam.responsibleUserId) {
    return null;
  }
  const [r] = await db
    .select({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role })
    .from(user)
    .where(eq(user.id, fam.responsibleUserId));
  return r ? { id: r.id, name: r.name, email: r.email, phone: r.phone, trains: r.role !== 'responsible' } : null;
}

// A family's members: users linked to it who still belong to its academy (a stale link after a move doesn't count).
function membersOf(fam: FamilyRow) {
  return and(eq(user.familyId, fam.id), eq(user.academyId, fam.academyId));
}

async function familyResponse(fam: FamilyRow) {
  return buildFamily(fam, await loadStudentBilling(membersOf(fam)), new Date(), await loadResponsible(fam));
}

// Sets family_id only for students not already in a family; throws with the ones that were taken.
async function claimMembers(tx: Pick<typeof db, 'update'>, familyId: string, studentIds: string[]) {
  const claimed = await tx
    .update(user)
    .set({ familyId })
    .where(and(inArray(user.id, studentIds), isNull(user.familyId)))
    .returning({ id: user.id });
  const taken = studentIds.filter((id) => !claimed.some((c) => c.id === id));
  if (taken.length > 0) {
    throw new StudentInFamilyError(taken);
  }
}

async function academyStudentIds(ids: string[], academyId: string) {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, ids), eq(user.academyId, academyId), eq(user.role, 'student')));
  return rows.map((r) => r.id);
}

const digits = (phone: string) => phone.replace(/\D/g, '');

export async function familyRoutes(app: FastifyInstance) {
  const owner = { preHandler: [requireOwner, injectAcademyId] };

  app.get('/api/families', owner, async (request) => {
    const families = await db
      .select()
      .from(family)
      .where(and(eq(family.academyId, request.academyId), isNull(family.deletedAt)))
      .orderBy(family.name);
    // ponytail: one members query per family; batch it if academies grow to hundreds of families.
    return Promise.all(families.map(familyResponse));
  });

  app.get('/api/families/suggestions', owner, async (request) => {
    const [students, dismissed] = await Promise.all([
      db
        .select({ id: user.id, name: user.name, phone: user.phone })
        .from(user)
        .where(and(
          eq(user.academyId, request.academyId),
          eq(user.role, 'student'),
          isNull(user.familyId),
          isNotNull(user.phone),
        ))
        .orderBy(user.name),
      db
        .select({ phone: familySuggestionDismissal.phone })
        .from(familySuggestionDismissal)
        .where(eq(familySuggestionDismissal.academyId, request.academyId)),
    ]);
    const skip = new Set(dismissed.map((d) => d.phone));
    const byPhone = new Map<string, { id: string; name: string }[]>();
    for (const s of students) {
      const phone = digits(s.phone!);
      if (!phone || skip.has(phone)) {
        continue;
      }
      byPhone.set(phone, [...(byPhone.get(phone) ?? []), { id: s.id, name: s.name }]);
    }
    return [...byPhone.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([phone, list]) => ({ phone, students: list }));
  });

  app.post('/api/families/suggestions/dismiss', owner, async (request, reply) => {
    const { phone } = (request.body ?? {}) as { phone?: unknown };
    const normalized = typeof phone === 'string' ? digits(phone) : '';
    if (!normalized) {
      return reply.status(400).send({ error: 'phone is required' });
    }
    await db
      .insert(familySuggestionDismissal)
      .values({ academyId: request.academyId, phone: normalized })
      .onConflictDoNothing();
    return reply.status(204).send();
  });

  app.get('/api/families/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    return familyResponse(fam);
  });

  app.post('/api/families', owner, async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: unknown;
      memberIds?: unknown;
      responsibleId?: unknown;
      responsible?: unknown;
      agreedPrice?: string | null;
    };
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!Array.isArray(body.memberIds) || body.memberIds.length === 0 || !body.memberIds.every((m) => typeof m === 'string')) {
      return reply.status(400).send({ error: 'memberIds must be a non-empty list' });
    }
    const memberIds = [...new Set(body.memberIds as string[])];
    const agreedPrice = body.agreedPrice ?? null;
    const newResponsible = body.responsible !== undefined ? parseNewResponsible(body.responsible) : null;
    const responsibleId = typeof body.responsibleId === 'string' ? body.responsibleId : null;
    if (responsibleId ? !memberIds.includes(responsibleId) : !newResponsible) {
      return reply.status(400).send({ error: 'A Responsible is required: responsibleId (a member) or responsible { name, email }' });
    }
    if (agreedPrice !== null && !MONEY.test(agreedPrice)) {
      return reply.status(400).send({ error: 'Invalid agreedPrice' });
    }
    if ((await academyStudentIds(memberIds, request.academyId)).length !== memberIds.length) {
      return reply.status(404).send({ error: 'Student not found' });
    }

    try {
      const created = await db.transaction(async (tx) => {
        const responsibleUserId = responsibleId ?? (await createResponsible(tx, request.academyId, newResponsible!));
        const [fam] = await tx
          .insert(family)
          .values({ academyId: request.academyId, name: body.name as string, responsibleUserId, agreedPrice })
          .returning();
        await claimMembers(tx, fam.id, memberIds);
        return fam;
      });
      return reply.status(201).send(await familyResponse(created));
    } catch (err) {
      if (err instanceof StudentInFamilyError) {
        return reply.status(409).send({ error: 'STUDENT_IN_FAMILY', studentIds: err.studentIds });
      }
      if (err instanceof EmailTakenError) {
        return reply.status(409).send({ error: 'EMAIL_TAKEN' });
      }
      throw err;
    }
  });

  app.put('/api/families/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: unknown; agreedPrice?: string | null };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }

    const changes: Partial<typeof family.$inferInsert> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return reply.status(400).send({ error: 'Invalid name' });
      }
      changes.name = body.name;
    }
    if (body.agreedPrice !== undefined) {
      if (body.agreedPrice !== null && !MONEY.test(body.agreedPrice)) {
        return reply.status(400).send({ error: 'Invalid agreedPrice' });
      }
      changes.agreedPrice = body.agreedPrice;
      changes.priceReviewNeeded = null;
    }

    if (Object.keys(changes).length === 0) {
      return familyResponse(fam);
    }
    const [updated] = await db.update(family).set(changes).where(eq(family.id, fam.id)).returning();
    return familyResponse(updated);
  });

  // Owner picks another member as Responsible, or a new person who doesn't train.
  app.put('/api/families/:id/responsible', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { userId?: unknown; name?: unknown; email?: unknown };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    let responsibleUserId: string;
    if (typeof body.userId === 'string') {
      const [member] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, body.userId), membersOf(fam)));
      if (!member) {
        return reply.status(400).send({ error: 'The Responsible must be a member' });
      }
      responsibleUserId = member.id;
    } else {
      const r = parseNewResponsible(body);
      if (!r) {
        return reply.status(400).send({ error: 'userId, or name and email, required' });
      }
      try {
        responsibleUserId = await createResponsible(db, request.academyId, r);
      } catch (err) {
        if (err instanceof EmailTakenError) {
          return reply.status(409).send({ error: 'EMAIL_TAKEN' });
        }
        throw err;
      }
    }
    const [updated] = await db.update(family).set({ responsibleUserId }).where(eq(family.id, fam.id)).returning();
    return familyResponse(updated);
  });

  // Sends the Responsible a set-password link (creates their login on first use).
  app.post('/api/families/:id/responsible/invite', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fam = await findFamily(id, request.academyId);
    const responsible = fam && (await loadResponsible(fam));
    if (!responsible) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    await auth.api.requestPasswordReset({ body: { email: responsible.email, redirectTo: `${APP_URL}/reset-password` } });
    return reply.status(204).send();
  });

  app.delete('/api/families/:id', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    await db.transaction(async (tx) => {
      await tx.update(family).set({ deletedAt: new Date() }).where(eq(family.id, fam.id));
      await tx.update(user).set({ familyId: null }).where(eq(user.familyId, fam.id));
    });
    return reply.status(204).send();
  });

  app.post('/api/families/:id/members', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { studentId } = (request.body ?? {}) as { studentId?: unknown };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    if (typeof studentId !== 'string' || (await academyStudentIds([studentId], request.academyId)).length === 0) {
      return reply.status(404).send({ error: 'Student not found' });
    }
    try {
      await claimMembers(db, fam.id, [studentId]);
    } catch (err) {
      if (err instanceof StudentInFamilyError) {
        return reply.status(409).send({ error: 'STUDENT_IN_FAMILY', studentIds: err.studentIds });
      }
      throw err;
    }
    if (fam.agreedPrice === null) {
      return familyResponse(fam);
    }
    const [updated] = await db.update(family).set({ priceReviewNeeded: new Date() }).where(eq(family.id, fam.id)).returning();
    return familyResponse(updated);
  });

  app.delete('/api/families/:id/members/:studentId', owner, async (request, reply) => {
    const { id, studentId } = request.params as { id: string; studentId: string };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    if (fam.responsibleUserId === studentId) {
      return reply.status(409).send({ error: 'RESPONSIBLE_REQUIRED' });
    }
    // Optional own email: the person can then create their login alone ("Primeiro acesso").
    const rawEmail = (request.body as { email?: unknown } | undefined)?.email;
    let email: string | undefined;
    if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '') {
      if (typeof rawEmail !== 'string' || !EMAIL.test(rawEmail.trim())) {
        return reply.status(400).send({ error: 'Invalid email' });
      }
      email = rawEmail.trim().toLowerCase();
      const [other] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
      if (other && other.id !== studentId) {
        return reply.status(409).send({ error: 'EMAIL_TAKEN' });
      }
      // The email is only for someone without a login yet; changing a login's email would hand the account over.
      const [login] = await db.select({ id: account.id }).from(account).where(eq(account.userId, studentId)).limit(1);
      if (login) {
        return reply.status(409).send({ error: 'MEMBER_HAS_LOGIN' });
      }
    }
    const removed = await db
      .update(user)
      .set({ familyId: null, ...(email ? { email } : {}) })
      .where(and(eq(user.id, studentId), membersOf(fam)))
      .returning({ id: user.id });
    if (removed.length === 0) {
      return reply.status(404).send({ error: 'Student is not a member' });
    }
    const changes: Partial<typeof family.$inferInsert> = {};
    if (fam.agreedPrice !== null) {
      changes.priceReviewNeeded = new Date();
    }
    if (Object.keys(changes).length === 0) {
      return familyResponse(fam);
    }
    const [updated] = await db.update(family).set(changes).where(eq(family.id, fam.id)).returning();
    return familyResponse(updated);
  });

  app.get('/api/families/:id/billing', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    const members = await loadStudentBilling(membersOf(fam));
    return familyBilling(fam.agreedPrice, members, new Date());
  });

  app.post('/api/families/:id/payments', owner, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { months?: unknown; amount?: unknown; paymentDate?: unknown };
    const fam = await findFamily(id, request.academyId);
    if (!fam) {
      return reply.status(404).send({ error: 'Family not found' });
    }
    if (!Array.isArray(body.months) || body.months.length === 0 || !body.months.every((m) => typeof m === 'string' && MONTH.test(m))) {
      return reply.status(400).send({ error: 'months must be a non-empty list of YYYY-MM' });
    }
    if (typeof body.amount !== 'string' || !MONEY.test(body.amount)) {
      return reply.status(400).send({ error: 'Invalid amount' });
    }
    if (body.paymentDate !== undefined && (typeof body.paymentDate !== 'string' || !DATE.test(body.paymentDate))) {
      return reply.status(400).send({ error: 'Invalid paymentDate' });
    }
    const months = [...new Set(body.months as string[])].sort();
    const amount = body.amount;
    const paymentDate = (body.paymentDate as string | undefined) ?? dateKey(new Date());

    // Members already paid for a month (individual payment) are not charged again.
    const members = await loadStudentBilling(membersOf(fam));
    const splitMonths = months.map((month) => ({
      month,
      members: members
        .filter((m) => memberStatus(m, month) === 'owed')
        .map((m) => ({ studentId: m.studentId, fee: m.membership!.fee })),
    }));
    const empty = splitMonths.find((m) => m.members.length === 0);
    if (empty) {
      return reply.status(400).send({ error: 'NO_BILLABLE_MEMBER', month: empty.month });
    }
    const shares = splitFamilyPayment(amount, splitMonths);

    const result = await db.transaction(async (tx) => {
      const [fp] = await tx
        .insert(familyPayment)
        .values({ familyId: fam.id, academyId: request.academyId, totalAmount: amount, paymentDate, months, recordedBy: request.user.id })
        .returning();
      const payments = await tx
        .insert(payment)
        .values(shares.map((s) => ({
          studentId: s.studentId,
          academyId: request.academyId,
          amount: s.amount,
          paymentDate,
          referenceMonth: s.month,
          familyPaymentId: fp.id,
          recordedBy: request.user.id,
        })))
        .returning();
      return { familyPayment: fp, payments };
    });
    return reply.status(201).send(result);
  });
}
