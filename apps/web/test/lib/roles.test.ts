import { describe, it, expect } from 'vitest';
import { isOwner, isStudent } from '@/lib/roles';

describe('roles helper', () => {
  it('isOwner true only for owner role', () => {
    expect(isOwner({ role: 'owner' })).toBe(true);
    expect(isOwner({ role: 'student' })).toBe(false);
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
    expect(isOwner({})).toBe(false);
    expect(isOwner({ role: null })).toBe(false);
  });

  it('isStudent true only for student role', () => {
    expect(isStudent({ role: 'student' })).toBe(true);
    expect(isStudent({ role: 'owner' })).toBe(false);
    expect(isStudent(null)).toBe(false);
    expect(isStudent(undefined)).toBe(false);
    expect(isStudent({})).toBe(false);
    expect(isStudent({ role: null })).toBe(false);
  });
});
