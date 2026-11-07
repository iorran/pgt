import { describe, it, expect } from 'vitest';
import { parseCleanRoster, planImport, isCleanRosterCsv } from '../../src/db/clean-roster';

// Shape of seed-data/2027-ativo.limpo.csv (generated after the data review).
const header = 'linha,nome,tipo,dependente,faixa,modalidades,email,nascimento,telefone,mensalidade,familia,responsavel_nome,responsavel_email,observacao,aviso';
const csv = [
  '﻿' + header,
  '4,Pedro Alves,adulto,,Branca,Jiu-Jitsu + MMA,pedro@x.com,1988-03-05,912345678,65.00,,,,,',
  '130,Karina Costa,adulto,sim,Branca,Jiu-Jitsu,,,,35.00,Costa,Rafael Costa,costa70@x.com,,',
  '131,Rafael Costa,adulto,,Roxa,Jiu-Jitsu,costa70@x.com,,,35.00,Costa,,,,',
  '133,Livia Costa,kid,sim,Amarela,Jiu-Jitsu,,,,35.00,Costa,Rafael Costa,costa70@x.com,,sem data de nascimento',
  '12,Alice Lima,kid,sim,Branca,Kids,,2016-06-08,911000001,35.00,Lima,Paula Lima,paula@x.com,,',
  '13,Afonso Lima,kid,sim,Branca,Kids,,2011-03-23,,35.00,Lima,Paula Lima,paula@x.com,,',
  '19,Benjamin Moura,kid,sim,Cinza e Branca,Kids,,2021-07-03,911000002,35.00,,Sara,sara@x.com,,',
  '30,Joana Melo,adulto,,,Funcional,joana@x.com,1986-09-05,,35.00,,,,,sem faixa',
  '66,Ricardo Reis,adulto,,Branca,,ricardo@x.com,,,200.00,,,,Aula particular,',
].join('\r\n');

describe('parseCleanRoster', () => {
  const rows = parseCleanRoster(csv);

  it('recognises the format', () => {
    expect(isCleanRosterCsv(csv)).toBe(true);
    expect(isCleanRosterCsv('faixa,MODALIDAD,MOME,EMAIL')).toBe(false);
  });

  it('maps a row to the app fields', () => {
    expect(rows[0]).toEqual({
      name: 'Pedro Alves', dependent: false, belt: 'white', modalities: ['Jiu-Jitsu', 'MMA'], email: 'pedro@x.com',
      dateOfBirth: '1988-03-05', phone: '912345678', monthlyFee: '65.00', family: null,
      responsibleName: null, responsibleEmail: null, trainingNote: null,
    });
  });

  it('maps Portuguese belts; no belt → white; no modality → none', () => {
    expect(rows.map((r) => r.belt)).toEqual(['white', 'white', 'purple', 'yellow', 'white', 'white', 'grey-white', 'white', 'white']);
    expect(rows[8]).toMatchObject({ modalities: [], trainingNote: 'Aula particular' });
  });
});

describe('planImport', () => {
  const plan = planImport(parseCleanRoster(csv));

  it('one family per Costa/Lima, plus one for a Dependent with a Responsible but no family', () => {
    expect(plan.families.map((f) => f.name).sort()).toEqual(['Costa', 'Lima', 'Moura']);
  });

  it('a Responsible who trains is the member that owns the email', () => {
    const costa = plan.families.find((f) => f.name === 'Costa')!;
    expect(costa.responsible).toEqual({ kind: 'member', email: 'costa70@x.com' });
    expect(costa.memberNames.sort()).toEqual(['Karina Costa', 'Livia Costa', 'Rafael Costa']);
  });

  it('a Responsible who doesn\'t train becomes a login-only person', () => {
    const lima = plan.families.find((f) => f.name === 'Lima')!;
    expect(lima.responsible).toEqual({ kind: 'new', name: 'Paula Lima', email: 'paula@x.com' });
    const moura = plan.families.find((f) => f.name === 'Moura')!;
    expect(moura).toMatchObject({ responsible: { kind: 'new', name: 'Sara', email: 'sara@x.com' }, memberNames: ['Benjamin Moura'] });
  });

  it('students outside families keep their own email', () => {
    expect(plan.families.flatMap((f) => f.memberNames)).not.toContain('Pedro Alves');
  });
});
