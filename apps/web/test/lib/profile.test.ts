import { describe, it, expect, beforeEach } from 'vitest';
import { getActingAs, setActingAs, clearProfile, wasProfileChosen, markProfileChosen } from '@/lib/profile';

describe('profile storage (per tab)', () => {
  beforeEach(() => clearProfile());

  it('stores and reads the Dependent being acted as', () => {
    expect(getActingAs()).toBeNull();
    setActingAs({ id: 'd1', name: 'Livia', belt: 'yellow', image: null });
    expect(getActingAs()).toEqual({ id: 'd1', name: 'Livia', belt: 'yellow', image: null });
    setActingAs(null);
    expect(getActingAs()).toBeNull();
  });

  it('remembers that a profile was chosen; sign out clears everything', () => {
    expect(wasProfileChosen()).toBe(false);
    markProfileChosen();
    setActingAs({ id: 'd1', name: 'Livia', belt: 'white', image: null });
    expect(wasProfileChosen()).toBe(true);
    clearProfile();
    expect(wasProfileChosen()).toBe(false);
    expect(getActingAs()).toBeNull();
  });
});
