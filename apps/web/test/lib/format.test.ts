import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatMonth, formatList, signedPoints } from '@/lib/format';

describe('formatMoney', () => {
  it('formats decimal strings from the API as euros', () => {
    expect(formatMoney('45.00', 'pt-PT')).toMatch(/45,00\s€/);
    expect(formatMoney('1234.5', 'en')).toBe('€1,234.50');
  });

  it('uses Portugal style when the app is in Portuguese', () => {
    expect(formatMoney('30', 'pt-BR')).toMatch(/^30,00\s€$/);
  });
});

describe('formatDate', () => {
  it('formats a YYYY-MM-DD date without a UTC day shift', () => {
    expect(formatDate('2026-03-01', 'pt-BR')).toBe('01/03/2026');
  });
});

describe('signedPoints', () => {
  it('prefixes + for gains and a real minus sign for losses', () => {
    expect(signedPoints(5)).toBe('+5');
    expect(signedPoints(-3)).toBe('\u22123');
    expect(signedPoints(0)).toBe('0');
  });
});

describe('formatMonth', () => {
  it('spells out a YYYY-MM month in the UI language', () => {
    expect(formatMonth('2026-08', 'pt-BR')).toBe('agosto de 2026');
    expect(formatMonth('2026-08', 'en')).toBe('August 2026');
  });
});

describe('formatList', () => {
  it('joins names the way the UI language does', () => {
    expect(formatList(['Ana', 'Bia', 'Caio'], 'pt-BR')).toBe('Ana, Bia e Caio');
    expect(formatList(['Ana', 'Bia'], 'en')).toBe('Ana and Bia');
  });
});
