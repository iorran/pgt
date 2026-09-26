import { describe, it, expect } from 'vitest';
import { parseCsv, parseRoster } from '../../src/db/roster-csv';

describe('parseCsv', () => {
  it('handles quoted fields with commas, newlines and escaped quotes', () => {
    const text = 'a,"b,c","d\n\n",""""\r\nx,y,,z\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b,c', 'd\n\n', '"'],
      ['x', 'y', '', 'z'],
    ]);
  });
});

describe('parseRoster', () => {
  const csv = [
    ',,,,,,',
    ',,nome,TURMA // MODALIDAD,MENSALIDAD,TELEFONO,INICIO',
    ', 1, Luis  fernandes,JIU-JITSU,"30,00 €",,ENERO',
    ',3,"Agatha Rocha\n\n",KIDS II,"35,00 €",969 736 590,"MARZO (ENERO Y FEBRERO NO ENTRENO)"',
    ',14,LUIS FERNANDES,JIU-JITSU,"45,00 €",927125335,FEVREIRO',
    ',,Mauro,jiu,"40,00 €",mes abuso,AULA ABUSO',
    ',,Bruno,jiu,65,936881067‬  ,julho',
    ',,,,,,',
    ',,,TOTAL,"8 141,00 €",,',
  ].join('\n');

  it('skips header/blank/total rows, cleans fields, dedupes names', () => {
    expect(parseRoster(csv)).toEqual([
      { name: 'Luis fernandes', phone: null, price: '30.00', joinMonth: 1 },
      { name: 'Agatha Rocha', phone: '969736590', price: '35.00', joinMonth: 3 },
      { name: 'Mauro', phone: null, price: '40.00', joinMonth: 1 },
      { name: 'Bruno', phone: '936881067', price: '65.00', joinMonth: 7 },
    ]);
  });
});
