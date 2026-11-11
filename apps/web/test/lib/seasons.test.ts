import { describe, it, expect } from 'vitest';
import { defaultSeasonId, isSeasonActive } from '@/lib/seasons';

const season = (id: string, startDate: string, endDate: string) => ({ id, startDate, endDate });

describe('isSeasonActive', () => {
  it('is decided by the date range only, both ends inclusive', () => {
    expect(isSeasonActive(season('s', '2026-01-01', '2026-12-31'), '2026-01-01')).toBe(true);
    expect(isSeasonActive(season('s', '2026-01-01', '2026-12-31'), '2026-12-31')).toBe(true);
    expect(isSeasonActive(season('s', '2025-01-01', '2025-12-31'), '2026-11-11')).toBe(false);
    expect(isSeasonActive(season('s', '2027-01-01', '2027-12-31'), '2026-11-11')).toBe(false);
  });
});

describe('defaultSeasonId', () => {
  it('picks the season running today', () => {
    const seasons = [season('future', '2027-01-01', '2027-12-31'), season('now', '2026-01-01', '2026-12-31')];
    expect(defaultSeasonId(seasons, '2026-11-11')).toBe('now');
  });

  it('falls back to the first (newest) season, or none', () => {
    const seasons = [season('newest', '2025-06-01', '2025-12-31'), season('old', '2024-01-01', '2024-12-31')];
    expect(defaultSeasonId(seasons, '2026-11-11')).toBe('newest');
    expect(defaultSeasonId([], '2026-11-11')).toBe('');
  });
});
