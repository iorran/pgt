import { describe, it, expect } from 'vitest';
import { csvMoney, toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('writes Portuguese-Excel CSV: BOM, semicolons, CRLF, quoted cells only when needed', () => {
    const csv = toCsv([
      ['Aluno', 'Pago'],
      ['Ana; "Lima"', csvMoney('22.5')],
      [null, 3],
    ]);
    expect(csv).toBe('﻿Aluno;Pago\r\n"Ana; ""Lima""";22,50\r\n;3');
  });
});

describe('csvMoney', () => {
  it('uses a comma decimal and no thousands separator', () => {
    expect(csvMoney('1200.00')).toBe('1200,00');
    expect(csvMoney('-12.3')).toBe('-12,30');
  });
});
