import { describe, it, expect } from 'vitest';
import { parseActiveRoster, isActiveRosterCsv, parseBelt, parseBirthDate } from '../../src/db/active-roster-csv';

// Shape of the "2027 activo" tab: faixa, MODALIDAD, MOME, EMAIL, DATA, TLF, $$, responsable, familia
const csv = [
  ',,,,,,,,',
  ',,,,,,,,',
  'faixa,MODALIDAD,MOME,EMAIL,DATA,TLF,$$,responsable,familia',
  'BRANCA,MMA / JIUJITSU,Pedro  Alves ,Pedro@Gmail.com,05/03/1988,912 345 678,65,,',
  'BRANCA,KIDS II,Alice,,8 junho 2016,,35,,FAMILIA LIMA',
  'BRANCA,KIDS II,Afonso,,23 março 2011,,35,limas,familia lima ',
  'cinza-blanco ,KIDS I,Benjamin,ana@gma,29/03/20023,,,sara ,',
  ',JIUJITSU,Hugo,joao@gmail.com Si,934567890,,135,"até fevereiro, depois 45",',
  'branca,JIUJITSU,Arthur,,13/12/2013,,30,FAMILIA Pereira,',
  ',,,,,,,,',
].join('\n');

describe('isActiveRosterCsv', () => {
  it('recognises the sheet by its EMAIL header', () => {
    expect(isActiveRosterCsv(csv)).toBe(true);
    expect(isActiveRosterCsv(',,nome,TURMA // MODALIDAD,MENSALIDAD,TELEFONO,INICIO')).toBe(false);
  });
});

describe('parseBelt', () => {
  it.each([
    ['BRANCA', 'white'], ['branca', 'white'], ['', 'white'], ['cinza', 'grey'], ['cinza-blanco ', 'grey-white'],
    ['amarelha', 'yellow'], ['laranja e branca', 'orange-white'], ['VERDE', 'green'], ['azul', 'blue'],
    ['ROXO', 'purple'], ['roxa', 'purple'], ['MARRON', 'brown'], ['preta', 'black'], ['???', 'white'],
  ])('%s -> %s', (raw, belt) => {
    expect(parseBelt(raw)).toBe(belt);
  });
});

describe('parseBirthDate', () => {
  it.each([
    ['05/03/1988', '1988-03-05'], ['10/9/1996', '1996-09-10'], ['8 junho 2016', '2016-06-08'],
    ['23 março 2011', '2011-03-23'], ['29/03/20023', null], ['934567890', null], ['', null], ['31/02/2010', null],
  ])('%s -> %s', (raw, iso) => {
    expect(parseBirthDate(raw)).toBe(iso);
  });
});

describe('parseActiveRoster', () => {
  const rows = parseActiveRoster(csv);

  it('skips header and blank rows', () => {
    expect(rows.map((r) => r.name)).toEqual(['Pedro Alves', 'Alice', 'Afonso', 'Benjamin', 'Hugo', 'Arthur']);
  });

  it('maps a full row', () => {
    expect(rows[0]).toEqual({
      name: 'Pedro Alves',
      email: 'pedro@gmail.com',
      phone: '912345678',
      dateOfBirth: '1988-03-05',
      belt: 'white',
      price: '65.00',
      trainingNote: 'MMA / JIUJITSU',
      modalities: ['Jiu-Jitsu', 'MMA'],
      family: null,
    });
  });

  it('drops invalid emails but keeps a valid one followed by junk', () => {
    expect(rows[3].email).toBeNull();
    expect(rows[4].email).toBe('joao@gmail.com');
  });

  it('groups families case-insensitively from either column', () => {
    expect(rows[1].family).toBe('Lima');
    expect(rows[2].family).toBe('Lima');
    expect(rows[5].family).toBe('Pereira');
  });

  it('keeps non-family responsable text in the training note; missing price is 0', () => {
    expect(rows[3]).toMatchObject({ price: '0.00', belt: 'grey-white', trainingNote: 'KIDS I · sara', modalities: ['Kids'] });
    expect(rows[4].trainingNote).toBe('JIUJITSU · até fevereiro, depois 45');
    expect(rows[2].trainingNote).toBe('KIDS II · limas');
  });
});
