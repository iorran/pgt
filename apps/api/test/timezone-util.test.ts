import { describe, it, expect } from 'vitest';
import { isoDateInTz, weekBoundsInTz, monthBoundsInTz, DEFAULT_ACADEMY_TIMEZONE } from '../src/utils/timezone.js';

describe('timezone utils', () => {
  it('exposes Europe/Lisbon as the default', () => {
    expect(DEFAULT_ACADEMY_TIMEZONE).toBe('Europe/Lisbon');
  });

  it('formats a UTC timestamp as a calendar date in academy TZ', () => {
    // 2026-04-22T23:30:00Z → Lisbon (UTC+1 in April due to DST) → 2026-04-23
    expect(isoDateInTz(new Date('2026-04-22T23:30:00Z'), 'Europe/Lisbon')).toBe('2026-04-23');
    // Same instant in Sao Paulo (UTC-3) → 2026-04-22
    expect(isoDateInTz(new Date('2026-04-22T23:30:00Z'), 'America/Sao_Paulo')).toBe('2026-04-22');
  });

  it('returns ISO week bounds (Mon 00:00 → next Mon 00:00) in academy TZ', () => {
    // 2026-04-23 is a Thursday in Lisbon. ISO week is Mon 2026-04-20 → Mon 2026-04-27.
    const { fromUtc, toUtc } = weekBoundsInTz('2026-04-23', 'Europe/Lisbon');
    expect(isoDateInTz(fromUtc, 'Europe/Lisbon')).toBe('2026-04-20');
    expect(isoDateInTz(toUtc, 'Europe/Lisbon')).toBe('2026-04-27');
  });

  it('returns calendar month bounds in academy TZ', () => {
    const { fromUtc, toUtc } = monthBoundsInTz('2026-04-23', 'Europe/Lisbon');
    expect(isoDateInTz(fromUtc, 'Europe/Lisbon')).toBe('2026-04-01');
    expect(isoDateInTz(toUtc, 'Europe/Lisbon')).toBe('2026-05-01');
  });
});
