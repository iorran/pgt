import { describe, it, expect } from 'vitest';
import { isoDateInTz, weekBoundsInTz, monthBoundsInTz, startOfDayInTz, dayInTz, DEFAULT_ACADEMY_TIMEZONE } from '../src/utils/timezone.js';
import { sql } from 'drizzle-orm';

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

describe('startOfDayInTz — DST boundaries', () => {
  it('handles Europe/Lisbon spring-forward (2026-03-29)', () => {
    // On 2026-03-29, Lisbon moves from WET (UTC+0) to WEST (UTC+1) at 01:00 local.
    // Local midnight 00:00 WET == 2026-03-29T00:00:00Z.
    const d = startOfDayInTz('2026-03-29', 'Europe/Lisbon');
    expect(d.toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('handles a half-hour offset (Asia/Kolkata, UTC+05:30)', () => {
    // Local midnight 2026-04-23 00:00 IST == 2026-04-22T18:30:00Z.
    const d = startOfDayInTz('2026-04-23', 'Asia/Kolkata');
    expect(d.toISOString()).toBe('2026-04-22T18:30:00.000Z');
  });

  it('handles a western hemisphere tz (America/Sao_Paulo, UTC-03)', () => {
    // Brazil ended DST in 2019, so Sao Paulo is stable UTC-3 year-round.
    // Local midnight 2026-04-23 00:00 BRT == 2026-04-23T03:00:00Z.
    const d = startOfDayInTz('2026-04-23', 'America/Sao_Paulo');
    expect(d.toISOString()).toBe('2026-04-23T03:00:00.000Z');
  });
});

describe('dayInTz SQL', () => {
  it('parameterizes the timezone (no string interpolation)', () => {
    // Fake a column reference for snapshot purposes.
    const fragment = dayInTz(sql`"checkin"."checked_in_at"`, 'Europe/Lisbon');
    const compiled = fragment.toQuery({ casing: 'snake_case', escapeName: (n) => `"${n}"`, escapeParam: (i) => `$${i + 1}`, escapeString: (s) => `'${s}'` } as any);
    // Timezone must appear as a parameter, not inlined in the SQL text.
    expect(compiled.sql).not.toContain('Europe/Lisbon');
    expect(compiled.params).toContain('Europe/Lisbon');
  });
});
