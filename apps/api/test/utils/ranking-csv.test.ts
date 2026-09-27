import { describe, it, expect } from 'vitest';
import { parseBeltText, parseRanking, matchStudent } from '../../src/db/ranking-csv';

describe('parseBeltText', () => {
  it.each([
    ['🥇  Amarela-Kids', 'yellow'],
    ['AMARELHA - KIDS', 'yellow'],
    ['KIDS - AMARELA', 'yellow'],
    ['🥈Azul - Adulto', 'blue'],
    ['Azul - adolecente', 'blue'],
    [' Preta - Adulto', 'black'],
    ['PRETA - MASTER', 'black'],
    ['marron - adulto', 'brown'],
    ['laranja e branca - kids', 'orange-white'],
    ['laranja é branca - kids', 'orange-white'],
    ['cinza e branca - KIDS', 'grey-white'],
    ['cinza e preta - KIDS', 'grey-black'],
    ['cinza - branca', 'grey-white'],
    ['🥉Branca-adulto', 'white'],
    ['BRANCA - JUVENIL', 'white'],
    ['Roxa - adulto', 'purple'],
    ['verde e preta - kids', 'green-black'],
    ['???', null],
  ])('%s -> %s', (text, belt) => {
    expect(parseBeltText(text)).toBe(belt);
  });
});

describe('parseRanking', () => {
  it('skips the title/header, strips emojis and trims names', () => {
    const csv = [
      ',                🏆 RANKING DE PGT PONTINA,,',
      ',Faixa - Categoría,Nome,Puntos',
      ',🥇  Amarela-Kids,👑 Guilherme,22',
      ',marron - adulto,"Jandira José \n",9',
      ',,,',
    ].join('\n');
    expect(parseRanking(csv)).toEqual([
      { name: 'Guilherme', beltText: 'Amarela-Kids', belt: 'yellow', points: 22 },
      { name: 'Jandira José', beltText: 'marron - adulto', belt: 'brown', points: 9 },
    ]);
  });
});

describe('matchStudent', () => {
  const students = [
    { id: '1', name: 'JEREMIAS Timóteo Mubiala' },
    { id: '2', name: 'Guilherme Dias' },
    { id: '3', name: 'Guilherme Melâneo' },
    { id: '4', name: 'Gonçalo Vieira Casado' },
    { id: '5', name: 'jandira jose' },
  ];
  it('matches exact names ignoring case/accents', () => {
    expect(matchStudent('Jandira José', students)).toEqual({ status: 'ok', student: students[4] });
  });
  it('matches when every word of the sheet name appears in one student name', () => {
    expect(matchStudent('Gonçalo Casado', students)).toEqual({ status: 'ok', student: students[3] });
    expect(matchStudent('Jeremias', students)).toEqual({ status: 'ok', student: students[0] });
  });
  it('reports ambiguous and missing names instead of guessing', () => {
    expect(matchStudent('Guilherme', students)).toMatchObject({ status: 'ambiguous', candidates: [students[1], students[2]] });
    expect(matchStudent('Luna Silva', students)).toEqual({ status: 'none' });
  });
});
