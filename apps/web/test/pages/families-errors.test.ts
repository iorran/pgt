import { describe, it, expect } from 'vitest';
import { familyErrorKey } from '@/pages/students/families';

describe('familyErrorKey', () => {
  it('explains that a member with their own login keeps their email', () => {
    expect(familyErrorKey(new Error('MEMBER_HAS_LOGIN'))).toBe('families.errors.memberHasLogin');
  });

  it('falls back to the generic error for unknown codes', () => {
    expect(familyErrorKey(new Error('SOMETHING_ELSE'))).toBe('common.genericError');
  });
});
