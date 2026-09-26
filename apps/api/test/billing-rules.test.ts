import { describe, it, expect } from 'vitest';
import {
  owedMonths,
  daysOverdue,
  memberStatus,
  familyFee,
  familyBilling,
  splitFamilyPayment,
  type MemberBilling,
} from '../src/billing/rules';

const today = new Date(2026, 8, 26); // 2026-09-26, local time

function member(
  studentId: string,
  fee: string | null,
  opts: { startDate?: string; dueDay?: number; paid?: string[]; waived?: string[] } = {},
): MemberBilling {
  return {
    studentId,
    membership: fee === null ? null : { startDate: opts.startDate ?? '2026-08-01', dueDay: opts.dueDay ?? 10, fee },
    paid: new Set(opts.paid ?? []),
    waived: new Set(opts.waived ?? []),
  };
}

describe('owedMonths', () => {
  it('lists unpaid months from start to current once the due day has passed', () => {
    expect(owedMonths(member('a', '35.00'), today)).toEqual(['2026-08', '2026-09']);
  });
  it('does not owe the current month before the due day', () => {
    expect(owedMonths(member('a', '35.00', { dueDay: 26 }), today)).toEqual(['2026-08']);
  });
  it('skips paid and waived months', () => {
    expect(owedMonths(member('a', '35.00', { paid: ['2026-08'], waived: ['2026-09'] }), today)).toEqual([]);
  });
  it('owes nothing on a free fee or without membership', () => {
    expect(owedMonths(member('a', '0.00'), today)).toEqual([]);
    expect(owedMonths(member('a', null), today)).toEqual([]);
  });
  it('walks across a year boundary', () => {
    const m = member('a', '10.00', { startDate: '2025-11-15', dueDay: 1 });
    expect(owedMonths(m, new Date(2026, 1, 5))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('daysOverdue', () => {
  it('counts days since the due date of the month', () => {
    expect(daysOverdue('2026-09', 10, today)).toBe(16);
  });
});

describe('memberStatus', () => {
  it('classifies a member for a month', () => {
    expect(memberStatus(member('a', null), '2026-09')).toBe('not-billed');
    expect(memberStatus(member('a', '0.00'), '2026-09')).toBe('not-billed');
    expect(memberStatus(member('a', '35.00', { startDate: '2026-09-01' }), '2026-08')).toBe('not-billed');
    expect(memberStatus(member('a', '35.00', { waived: ['2026-09'] }), '2026-09')).toBe('waived');
    expect(memberStatus(member('a', '35.00', { paid: ['2026-09'] }), '2026-09')).toBe('paid');
    expect(memberStatus(member('a', '35.00'), '2026-09')).toBe('owed');
  });
});

describe('familyFee', () => {
  it('sums members Monthly Fees', () => {
    expect(familyFee(null, [member('a', '35.00'), member('b', '35.00')], '2026-09')).toBe('70.00');
  });
  it('excludes a waived member', () => {
    expect(familyFee(null, [member('a', '35.00'), member('b', '35.00', { waived: ['2026-10'] })], '2026-10')).toBe('35.00');
  });
  it('uses the Family Agreed Price when set', () => {
    expect(familyFee('100.00', [member('a', '45.00'), member('b', '35.00'), member('c', '35.00')], '2026-09')).toBe('100.00');
  });
});

describe('familyBilling', () => {
  it('lists months any member owes with fee and per-member status', () => {
    const members = [member('bia', '35.00'), member('leo', '35.00', { paid: ['2026-08'] })];
    const billing = familyBilling(null, members, today);
    expect(billing.suggestedMonths).toEqual(['2026-08', '2026-09']);
    expect(billing.suggestedAmount).toBe('140.00');
    expect(billing.owedMonths[0]).toEqual({
      month: '2026-08',
      fee: '70.00',
      members: [
        { studentId: 'bia', status: 'owed' },
        { studentId: 'leo', status: 'paid' },
      ],
    });
  });
  it('is empty when nobody owes', () => {
    const billing = familyBilling(null, [member('a', '35.00', { paid: ['2026-08', '2026-09'] })], today);
    expect(billing).toEqual({ owedMonths: [], suggestedMonths: [], suggestedAmount: '0.00' });
  });
});

describe('splitFamilyPayment', () => {
  it('splits by Monthly Fee with the remainder on the last member (100 over 45/35/35)', () => {
    const rows = splitFamilyPayment('100.00', [
      { month: '2026-09', members: [{ studentId: 'carlos', fee: '45.00' }, { studentId: 'k1', fee: '35.00' }, { studentId: 'k2', fee: '35.00' }] },
    ]);
    expect(rows).toEqual([
      { studentId: 'carlos', month: '2026-09', amount: '39.13' },
      { studentId: 'k1', month: '2026-09', amount: '30.43' },
      { studentId: 'k2', month: '2026-09', amount: '30.44' },
    ]);
  });

  it('splits equally across months with equal fees, remainder on the last month', () => {
    const rows = splitFamilyPayment('100.00', [
      { month: '2026-07', members: [{ studentId: 'a', fee: '35.00' }] },
      { month: '2026-08', members: [{ studentId: 'a', fee: '35.00' }] },
      { month: '2026-09', members: [{ studentId: 'a', fee: '35.00' }] },
    ]);
    expect(rows.map((r) => r.amount)).toEqual(['33.33', '33.33', '33.34']);
  });

  it('weights months by what is charged, so paying exactly what is owed gives each member their Monthly Fee', () => {
    // Aug: both kids owe 35; Sep: laura waived, only diego owes 35. Family pays 105.
    const rows = splitFamilyPayment('105.00', [
      { month: '2026-08', members: [{ studentId: 'laura', fee: '35.00' }, { studentId: 'diego', fee: '35.00' }] },
      { month: '2026-09', members: [{ studentId: 'diego', fee: '35.00' }] },
    ]);
    expect(rows.map((r) => `${r.studentId} ${r.month} ${r.amount}`)).toEqual([
      'laura 2026-08 35.00',
      'diego 2026-08 35.00',
      'diego 2026-09 35.00',
    ]);
  });

  it('uses equal weights when all fees are 0', () => {
    const rows = splitFamilyPayment('10.00', [
      { month: '2026-09', members: [{ studentId: 'a', fee: '0.00' }, { studentId: 'b', fee: '0.00' }, { studentId: 'c', fee: '0.00' }] },
    ]);
    expect(rows.map((r) => r.amount)).toEqual(['3.33', '3.33', '3.34']);
  });

  it('always sums exactly to the total', () => {
    const rows = splitFamilyPayment('257.77', [
      { month: '2026-07', members: [{ studentId: 'a', fee: '45.00' }, { studentId: 'b', fee: '35.00' }, { studentId: 'c', fee: '33.00' }] },
      { month: '2026-08', members: [{ studentId: 'a', fee: '45.00' }, { studentId: 'c', fee: '33.00' }] },
      { month: '2026-09', members: [{ studentId: 'b', fee: '35.00' }] },
    ]);
    const cents = rows.reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0);
    expect(cents).toBe(25777);
    expect(rows).toHaveLength(6);
  });
});
