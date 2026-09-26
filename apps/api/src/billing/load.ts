import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { user, studentMembership, payment, waivedMonth } from '../db/schema/index.js';
import type { MemberBilling } from './rules.js';

export interface StudentBilling extends MemberBilling {
  name: string;
  email: string;
  belt: string;
  phone: string | null;
  familyId: string | null;
  createdAt: Date;
  notificationsMuted: boolean | null;
  dueDay: number | null;
}

// Loads students matching `where` (always role student) with their Monthly Fee, paid and waived months.
export async function loadStudentBilling(where: SQL | undefined): Promise<StudentBilling[]> {
  const rows = await db
    .select({
      studentId: user.id,
      name: user.name,
      email: user.email,
      belt: user.belt,
      phone: user.phone,
      familyId: user.familyId,
      createdAt: user.createdAt,
      notificationsMuted: studentMembership.notificationsMuted,
      monthlyFee: studentMembership.monthlyFee,
      dueDay: studentMembership.dueDay,
      startDate: studentMembership.startDate,
    })
    .from(user)
    .leftJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
    .where(and(eq(user.role, 'student'), where))
    .orderBy(user.createdAt, user.id);
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((r) => r.studentId);
  const [paidRows, waivedRows] = await Promise.all([
    db.select({ studentId: payment.studentId, month: payment.referenceMonth }).from(payment).where(inArray(payment.studentId, ids)),
    db.select({ studentId: waivedMonth.studentId, month: waivedMonth.referenceMonth }).from(waivedMonth).where(inArray(waivedMonth.studentId, ids)),
  ]);
  const group = (list: { studentId: string; month: string }[]) => {
    const map = new Map<string, Set<string>>();
    for (const r of list) {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, new Set());
      }
      map.get(r.studentId)!.add(r.month);
    }
    return map;
  };
  const paid = group(paidRows);
  const waived = group(waivedRows);

  return rows.map((r) => ({
    studentId: r.studentId,
    name: r.name,
    email: r.email,
    belt: r.belt,
    phone: r.phone,
    familyId: r.familyId,
    createdAt: r.createdAt,
    notificationsMuted: r.notificationsMuted,
    dueDay: r.dueDay,
    membership: r.monthlyFee !== null && r.startDate !== null && r.dueDay !== null
      ? { startDate: r.startDate, dueDay: r.dueDay, fee: r.monthlyFee }
      : null,
    paid: paid.get(r.studentId) ?? new Set(),
    waived: waived.get(r.studentId) ?? new Set(),
  }));
}
