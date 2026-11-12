import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { user, studentMembership, payment, waivedMonth, teacherAgreement } from '../db/schema/index.js';
import { fromCents, toCents, type MemberBilling } from './rules.js';

export interface StudentBilling extends MemberBilling {
  name: string;
  email: string;
  belt: string;
  phone: string | null;
  familyId: string | null;
  createdAt: Date;
  notificationsMuted: boolean | null;
  dueDay: number | null;
  monthlyFee: string | null;
  // Set while the Student has a Class Add-on; membership.fee already includes its price.
  addOn: { name: string; price: string } | null;
  // The Student's Teacher Agreement and how they are linked to it.
  agreement: { id: string; name: string; kind: 'addOn' | 'recruited' } | null;
}

// Loads students matching `where` (always role student) with what they owe per month (Monthly Fee + Class
// Add-on), paid and waived months.
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
      agreementId: user.agreementId,
      agreementKind: user.agreementKind,
      agreementName: teacherAgreement.name,
      addOnPrice: teacherAgreement.addOnPrice,
    })
    .from(user)
    .leftJoin(studentMembership, and(eq(studentMembership.studentId, user.id), eq(studentMembership.active, true)))
    .leftJoin(teacherAgreement, eq(teacherAgreement.id, user.agreementId))
    .where(and(eq(user.role, 'student'), where))
    .orderBy(user.createdAt, user.id);
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((r) => r.studentId);
  const [paidRows, waivedRows] = await Promise.all([
    // Only records of the student's current academy count: billing state stays with the academy.
    db.select({ studentId: payment.studentId, month: payment.referenceMonth })
      .from(payment)
      .innerJoin(user, and(eq(user.id, payment.studentId), eq(user.academyId, payment.academyId)))
      .where(inArray(payment.studentId, ids)),
    db.select({ studentId: waivedMonth.studentId, month: waivedMonth.referenceMonth })
      .from(waivedMonth)
      .innerJoin(user, and(eq(user.id, waivedMonth.studentId), eq(user.academyId, waivedMonth.academyId)))
      .where(inArray(waivedMonth.studentId, ids)),
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

  return rows.map((r) => {
    const addOn = r.agreementKind === 'addOn' && r.addOnPrice !== null ? { name: r.agreementName!, price: r.addOnPrice } : null;
    return {
      studentId: r.studentId,
      name: r.name,
      email: r.email,
      belt: r.belt,
      phone: r.phone,
      familyId: r.familyId,
      createdAt: r.createdAt,
      notificationsMuted: r.notificationsMuted,
      dueDay: r.dueDay,
      monthlyFee: r.monthlyFee,
      addOn,
      agreement: r.agreementId ? { id: r.agreementId, name: r.agreementName!, kind: r.agreementKind! } : null,
      membership:
        r.monthlyFee !== null && r.startDate !== null && r.dueDay !== null
          ? {
              startDate: r.startDate,
              dueDay: r.dueDay,
              fee: fromCents(toCents(r.monthlyFee) + (addOn ? toCents(addOn.price) : 0)),
            }
          : null,
      paid: paid.get(r.studentId) ?? new Set(),
      waived: waived.get(r.studentId) ?? new Set(),
    };
  });
}
