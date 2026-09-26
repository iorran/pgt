import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate } from '@/lib/format';

describe('formatMoney', () => {
  it('formats decimal strings from the API as euros', () => {
    expect(formatMoney('45.00', 'pt-PT')).toMatch(/45,00\s€/);
    expect(formatMoney('1234.5', 'en')).toBe('€1,234.50');
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD date without a UTC day shift', () => {
    expect(formatDate('2026-03-01', 'pt-BR')).toBe('01/03/2026');
  });
});
