import { describe, it, expect } from 'vitest';
import ptBR from '@/i18n/pt-BR.json';
import en from '@/i18n/en.json';

const keys = (o: any, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe('i18n parity', () => {
  it('pt-BR and en define the same keys', () => {
    expect(keys(ptBR).sort()).toEqual(keys(en).sort());
  });
});
