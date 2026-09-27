import { describe, it, expect } from 'vitest';
import { ADULT_BELTS, ALL_BELTS, KIDS_BELTS, beltClasses, beltKey } from '@/lib/belts';
import ptBR from '@/i18n/pt-BR.json';
import en from '@/i18n/en.json';

describe('belts', () => {
  it('lists belts in IBJJF order', () => {
    expect(KIDS_BELTS).toEqual([
      'grey-white', 'grey', 'grey-black',
      'yellow-white', 'yellow', 'yellow-black',
      'orange-white', 'orange', 'orange-black',
      'green-white', 'green', 'green-black',
    ]);
    expect(ADULT_BELTS).toEqual(['blue', 'purple', 'brown', 'black']);
    expect(ALL_BELTS).toEqual(['white', ...KIDS_BELTS, ...ADULT_BELTS]);
    expect(ALL_BELTS).toHaveLength(17);
  });

  it('has pt-BR names for every belt', () => {
    expect((ptBR as any).belts).toEqual({
      white: 'Branca',
      'grey-white': 'Cinza e branca',
      grey: 'Cinza',
      'grey-black': 'Cinza e preta',
      'yellow-white': 'Amarela e branca',
      yellow: 'Amarela',
      'yellow-black': 'Amarela e preta',
      'orange-white': 'Laranja e branca',
      orange: 'Laranja',
      'orange-black': 'Laranja e preta',
      'green-white': 'Verde e branca',
      green: 'Verde',
      'green-black': 'Verde e preta',
      blue: 'Azul',
      purple: 'Roxa',
      brown: 'Marrom',
      black: 'Preta',
    });
  });

  it('has en names for every belt', () => {
    expect(Object.keys((en as any).belts).sort()).toEqual([...ALL_BELTS].sort());
    expect((en as any).belts['orange-white']).toBe('Orange-white');
  });

  it('gives every belt its own classes, two-tone belts a distinguishing stripe', () => {
    const classes = ALL_BELTS.map(b => beltClasses(b));
    expect(new Set(classes).size).toBe(17);
    expect(beltClasses('orange-white')).toContain('bg-belt-orange');
    expect(beltClasses('orange-white')).toContain('ring-white');
    expect(beltClasses('orange-black')).toContain('ring-black');
    expect(beltClasses('orange')).not.toContain('ring-');
  });

  it('falls back to white styling for unknown belts', () => {
    expect(beltClasses('BLUE')).toContain('bg-belt-blue');
    expect(beltClasses(undefined)).toBe(beltClasses('white'));
    expect(beltKey('grey-white')).toBe('belts.grey-white');
  });
});
