import { describe, it, expect } from 'vitest';
import { errorKey } from '@/lib/api-errors';

describe('errorKey', () => {
  it('maps known API codes to translated keys', () => {
    expect(errorKey(new Error('CHECKIN_DUPLICATE'))).toBe('classes.checkinDuplicate');
    expect(errorKey(new Error('OVERLAPPING_CLASS'))).toBe('classes.checkinOverlap');
    expect(errorKey(new Error('OUTSIDE_TIME_WINDOW'))).toBe('classes.checkinOutsideWindow');
    expect(errorKey(new Error('INVALID_TOKEN'))).toBe('classes.checkinInvalidToken');
    expect(errorKey(new Error('LOCATION_NOT_SET'))).toBe('classes.checkinLocationNotSet');
    expect(errorKey(new Error('TOO_FAR'))).toBe('classes.checkinTooFar');
  });

  it('explains that a family\u2019s Responsible must hand it over before changing academy', () => {
    expect(errorKey(new Error('RESPONSIBLE_OF_FAMILY'))).toBe('onboarding.responsibleOfFamily');
  });

  it('explains billing refusals', () => {
    expect(errorKey(new Error('NO_BILLABLE_MEMBER'))).toBe('billing.errors.noBillableMember');
    expect(errorKey(new Error('NOT_OVERDUE'))).toBe('billing.errors.notOverdue');
  });

  it('explains a seminar or participant that vanished meanwhile', () => {
    expect(errorKey(new Error('SEMINAR_NOT_FOUND'))).toBe('seminars.errors.gone');
    expect(errorKey(new Error('PARTICIPANT_NOT_FOUND'))).toBe('seminars.errors.participantGone');
  });

  it('explains finance refusals', () => {
    expect(errorKey(new Error('INVALID_PAYOUT_TEACHER'))).toBe('finance.errors.invalidTeacher');
    expect(errorKey(new Error('INVALID_AGREEMENT_LINK'))).toBe('finance.errors.invalidAgreementLink');
    expect(errorKey(new Error('INVALID_FINANCE_SETTINGS'))).toBe('finance.errors.invalidSettings');
    expect(errorKey(new Error('INVALID_EXPENSE'))).toBe('finance.errors.invalidExpense');
    expect(errorKey(new Error('INVALID_PAYOUT'))).toBe('finance.errors.invalidPayout');
    expect(errorKey(new Error('EXPENSE_NOT_FOUND'))).toBe('finance.errors.expenseGone');
  });

  it('falls back to the generic error for unknown or raw messages', () => {
    expect(errorKey(new Error('Request failed'))).toBe('common.genericError');
    expect(errorKey('nope')).toBe('common.genericError');
    expect(errorKey(undefined)).toBe('common.genericError');
  });
});
