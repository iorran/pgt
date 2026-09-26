// Parses the academy's student spreadsheet export (Google Sheets CSV).
// Columns: _, nº, nome, turma/modalidade, mensalidade, telefone, início, notes...

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface RosterStudent {
  name: string;
  phone: string | null;
  price: string;
  joinMonth: number;
}

// Spanish/Portuguese month prefixes as typed in the sheet (ENERO, FEVREIRO, MARCO, MAIO...).
const MONTHS: Record<string, number> = {
  ENE: 1, JAN: 1, FEB: 2, FEV: 2, MAR: 3, ABR: 4, MAI: 5, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, OUT: 10, NOV: 11, DIC: 12, DEZ: 12,
};
const MONTH_RE = new RegExp(Object.keys(MONTHS).join('|'));

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function parseRoster(text: string): RosterStudent[] {
  const seen = new Set<string>();
  const out: RosterStudent[] = [];
  for (const r of parseCsv(text)) {
    const name = (r[2] ?? '').replace(/\s+/g, ' ').trim();
    if (!name || name.toLowerCase() === 'nome' || (r[3] ?? '').trim().toUpperCase() === 'TOTAL') {
      continue;
    }
    const key = normalizeName(name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const digits = (r[5] ?? '').replace(/\D/g, '');
    const amount = Number((r[4] ?? '').replace(/[^\d,.]/g, '').replace(',', '.'));
    const month = (r[6] ?? '').toUpperCase().match(MONTH_RE)?.[0];
    out.push({
      name,
      phone: digits.length >= 9 ? digits : null,
      price: (Number.isFinite(amount) ? amount : 0).toFixed(2),
      joinMonth: month ? MONTHS[month] : 1,
    });
  }
  return out;
}
