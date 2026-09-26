import { describe, it, expect } from 'vitest';
import { parseCsv, parseModalities, parseRoster } from '../../src/db/roster-csv';

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
      { name: 'Luis fernandes', phone: null, price: '30.00', joinMonth: 1, modalityText: 'JIU-JITSU', modalities: ['Jiu-Jitsu'] },
      { name: 'Agatha Rocha', phone: '969736590', price: '35.00', joinMonth: 3, modalityText: 'KIDS II', modalities: ['Kids'] },
      { name: 'Mauro', phone: null, price: '40.00', joinMonth: 1, modalityText: 'jiu', modalities: ['Jiu-Jitsu'] },
      { name: 'Bruno', phone: '936881067', price: '65.00', joinMonth: 7, modalityText: 'jiu', modalities: ['Jiu-Jitsu'] },
    ]);
  });

  it('keeps the raw modality text trimmed, null when blank', () => {
    const rows = parseRoster(',,Ana,"  turma 16 hrs ",45,,\n,,Bia,,45,,');
    expect(rows.map((r) => [r.modalityText, r.modalities])).toEqual([['turma 16 hrs', []], [null, []]]);
  });
});

describe('parseModalities', () => {
  it.each([
    ['JIU-JITSU', ['Jiu-Jitsu']],
    ['JIUJITSU', ['Jiu-Jitsu']],
    ['JIU-JISU', ['Jiu-Jitsu']],
    ['jiu jiutsu', ['Jiu-Jitsu']],
    ['JIUJITSU TRANSITO LIVRE', ['Jiu-Jitsu']],
    ['JIU-JITSU KIDS II', ['Kids']],
    ['JIU-JISU kids I', ['Kids']],
    ['7 HRS // MMA- JIU-JITSU', ['Jiu-Jitsu', 'MMA']],
    ['MMA//JIU-JISU', ['Jiu-Jitsu', 'MMA']],
    ['mma', ['MMA']],
    ['MMA NOCHE', ['MMA']],
    ['MMA/ TREINO FUNCIONAL', ['MMA', 'Funcional']],
    ['TREINO FEMININO', ['Feminino']],
    ['JIU-JITSU  //TREINO FEMININO', ['Jiu-Jitsu', 'Feminino']],
    ['turma 16 hrs', []],
    ['', []],
  ])('%s -> %j', (text, expected) => {
    expect(parseModalities(text)).toEqual(expected);
  });
});
