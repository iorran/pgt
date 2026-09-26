import { describe, it, expect } from 'vitest';
import { beltClasses } from '@/lib/belts';
import ptBR from '@/i18n/pt-BR.json';

describe('belts', () => {
  it('has pt-BR names for every belt', () => {
    expect((ptBR as any).belts).toEqual({ white: 'Branca', blue: 'Azul', purple: 'Roxa', brown: 'Marrom', black: 'Preta' });
  });
  it('falls back to white styling for unknown belts', () => {
    expect(beltClasses('BLUE')).toContain('bg-belt-blue');
    expect(beltClasses(undefined)).toBe(beltClasses('white'));
  });
});
