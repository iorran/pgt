// Pure billing rules (see docs/CONTEXT.md and the families spec "Billing rules").
// Money is handled in integer cents internally; inputs/outputs are 2-decimal strings.

export interface Membership {
  startDate: string; // YYYY-MM-DD
  dueDay: number;
  fee: string; // Monthly Fee
}

export interface MemberBilling {
  studentId: string;
  membership: Membership | null;
  paid: Set<string>;
  waived: Set<string>;
}

export type MemberStatus = 'owed' | 'paid' | 'waived' | 'not-billed';

export function toCents(amount: string): number {
  return Math.round(Number(amount) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Local YYYY-MM-DD.
export function dateKey(d: Date): string {
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m, 1));
}

export function monthlyFee(planPrice: string, agreedPrice: string | null): string {
  return agreedPrice ?? planPrice;
}

// Months the student owes, oldest first: from membership start up to today, due day passed, not paid/waived, fee > 0.
export function owedMonths(member: MemberBilling, today: Date): string[] {
  const ms = member.membership;
  if (!ms || toCents(ms.fee) <= 0) {
    return [];
  }
  const current = monthKey(today);
  const owed: string[] = [];
  for (let month = ms.startDate.slice(0, 7); month <= current; month = nextMonth(month)) {
    if (month === current && today.getDate() <= ms.dueDay) {
      break;
    }
    if (!member.paid.has(month) && !member.waived.has(month)) {
      owed.push(month);
    }
  }
  return owed;
}

export function daysOverdue(month: string, dueDay: number, today: Date): number {
  const [y, m] = month.split('-').map(Number);
  const dueDate = new Date(y, m - 1, dueDay);
  return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function memberStatus(member: MemberBilling, month: string): MemberStatus {
  const ms = member.membership;
  if (!ms || toCents(ms.fee) <= 0 || month < ms.startDate.slice(0, 7)) {
    return 'not-billed';
  }
  if (member.waived.has(month)) {
    return 'waived';
  }
  if (member.paid.has(month)) {
    return 'paid';
  }
  return 'owed';
}

// Family Fee = Family Agreed Price, else Σ Monthly Fee of members billed and not waived that month.
export function familyFee(agreedPrice: string | null, members: MemberBilling[], month: string): string {
  if (agreedPrice !== null) {
    return fromCents(toCents(agreedPrice));
  }
  let cents = 0;
  for (const m of members) {
    const status = memberStatus(m, month);
    if (status === 'owed' || status === 'paid') {
      cents += toCents(m.membership!.fee);
    }
  }
  return fromCents(cents);
}

export function familyBilling(agreedPrice: string | null, members: MemberBilling[], today: Date) {
  const months = [...new Set(members.flatMap((m) => owedMonths(m, today)))].sort();
  const owed = months.map((month) => ({
    month,
    fee: familyFee(agreedPrice, members, month),
    members: members.map((m) => ({ studentId: m.studentId, status: memberStatus(m, month) })),
  }));
  return {
    owedMonths: owed,
    suggestedMonths: months,
    suggestedAmount: fromCents(owed.reduce((sum, o) => sum + toCents(o.fee), 0)),
  };
}

// Splits `total` by weights (floor), remainder cents on the last item; equal weights if all are 0.
function splitCents(total: number, weights: number[]): number[] {
  const w = weights.every((x) => x === 0) ? weights.map(() => 1) : weights;
  const sum = w.reduce((a, b) => a + b, 0);
  const shares = w.map((x) => Math.floor((total * x) / sum));
  shares[shares.length - 1] = total - shares.slice(0, -1).reduce((a, b) => a + b, 0);
  return shares;
}

export interface SplitMonth {
  month: string;
  members: { studentId: string; fee: string }[]; // members to charge that month (non-empty)
}

// Family Payment split (ADR 0001): across months by what each month charges, then by Monthly Fee within the
// month. Paying exactly what is owed gives every member their Monthly Fee; rows always sum exactly to total.
export function splitFamilyPayment(total: string, months: SplitMonth[]) {
  const monthWeights = months.map((m) => m.members.reduce((sum, x) => sum + toCents(x.fee), 0));
  const perMonth = splitCents(toCents(total), monthWeights);
  return months.flatMap((m, i) => {
    const shares = splitCents(perMonth[i], m.members.map((x) => toCents(x.fee)));
    return m.members.map((x, j) => ({ studentId: x.studentId, month: m.month, amount: fromCents(shares[j]) }));
  });
}
