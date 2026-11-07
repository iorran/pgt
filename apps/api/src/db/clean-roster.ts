import { parseCsv } from './roster-csv.js';

// Reads seed-data/2027-ativo.limpo.csv — the roster after the data review — and plans the import:
// one login per Family, Dependents without login (ADR 0004).

type Belt = 'white' | 'grey-white' | 'grey' | 'yellow' | 'orange-white' | 'orange' | 'green' | 'blue' | 'purple' | 'brown' | 'black';

export interface CleanStudent {
  name: string;
  dependent: boolean;
  belt: Belt;
  modalities: string[];
  email: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  monthlyFee: string;
  family: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  trainingNote: string | null;
}

export type PlannedResponsible = { kind: 'member'; email: string } | { kind: 'new'; name: string; email: string };

export interface PlannedFamily {
  name: string;
  memberNames: string[];
  memberIndexes: number[];
  responsible: PlannedResponsible;
}

const BELTS: Record<string, Belt> = {
  Branca: 'white', 'Cinza e Branca': 'grey-white', Cinza: 'grey', Amarela: 'yellow', 'Laranja e Branca': 'orange-white',
  Laranja: 'orange', Verde: 'green', Azul: 'blue', Roxa: 'purple', Marrom: 'brown', Preta: 'black',
};

const COLUMNS = ['nome', 'dependente', 'faixa', 'modalidades', 'email', 'nascimento', 'telefone', 'mensalidade', 'familia', 'responsavel_nome', 'responsavel_email', 'observacao'];

const headerOf = (text: string) => parseCsv(text.replace(/^﻿/, ''))[0]?.map((c) => c.trim()) ?? [];

export const isCleanRosterCsv = (text: string) => COLUMNS.every((c) => headerOf(text).includes(c));

export function parseCleanRoster(text: string): CleanStudent[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const get = (r: string[], name: string) => (r[col[name]] ?? '').trim();
  const orNull = (s: string) => s || null;
  return rows
    .filter((r) => get(r, 'nome'))
    .map((r) => ({
      name: get(r, 'nome'),
      dependent: get(r, 'dependente') === 'sim',
      belt: BELTS[get(r, 'faixa')] ?? 'white', // no belt (e.g. Funcional only) → white until belts are optional
      modalities: get(r, 'modalidades').split('+').map((m) => m.trim()).filter(Boolean),
      email: orNull(get(r, 'email').toLowerCase()),
      dateOfBirth: orNull(get(r, 'nascimento')),
      phone: orNull(get(r, 'telefone')),
      monthlyFee: get(r, 'mensalidade') || '0.00',
      family: orNull(get(r, 'familia')),
      responsibleName: orNull(get(r, 'responsavel_nome')),
      responsibleEmail: orNull(get(r, 'responsavel_email').toLowerCase()),
      trainingNote: orNull(get(r, 'observacao')),
    }));
}

// Dependents with a Responsible but no family get one, named after the first Dependent's surname.
export function planImport(students: CleanStudent[]) {
  const groups = new Map<string, number[]>();
  students.forEach((s, i) => {
    const key = s.family ?? (s.dependent && s.responsibleEmail ? `email:${s.responsibleEmail}` : null);
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
  });
  const families: PlannedFamily[] = [...groups.entries()].map(([key, indexes]) => {
    const members = indexes.map((i) => students[i]);
    const withResponsible = members.find((m) => m.dependent && m.responsibleEmail);
    const email = withResponsible?.responsibleEmail ?? members.find((m) => !m.dependent && m.email)?.email ?? null;
    const trainingResponsible = members.find((m) => !m.dependent && m.email && m.email === email);
    if (!email) {
      throw new Error(`Family ${key} has no Responsible email`);
    }
    return {
      name: key.startsWith('email:') ? members[0].name.split(' ').at(-1)! : key,
      memberNames: members.map((m) => m.name),
      memberIndexes: indexes,
      responsible: trainingResponsible
        ? { kind: 'member', email }
        : { kind: 'new', name: withResponsible?.responsibleName ?? `Responsável da família ${key}`, email },
    };
  });
  const emails = families.map((f) => f.responsible.email);
  const dup = emails.find((e, i) => emails.indexOf(e) !== i);
  if (dup) {
    throw new Error(`${dup} is the Responsible of two families`);
  }
  return { families };
}
