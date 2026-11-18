import { describe, it, expect } from 'vitest';
import ptBR from '@/i18n/pt-BR.json';

// pt-BR plural rules put 0 with 1 ("0 aluno"); every counted string needs a _zero form that reads plural.
function oneKeysWithoutZero(node: unknown, path = ''): string[] {
  if (typeof node !== 'object' || node === null) {
    return [];
  }
  const obj = node as Record<string, unknown>;
  return Object.keys(obj).flatMap((k) => {
    const here = path ? `${path}.${k}` : k;
    if (k.endsWith('_one') && !(k.replace(/_one$/, '_zero') in obj)) {
      return [here];
    }
    return oneKeysWithoutZero(obj[k], here);
  });
}

describe('pt-BR plurals', () => {
  it('has a _zero form for every _one string', () => {
    expect(oneKeysWithoutZero(ptBR)).toEqual([]);
  });
});
