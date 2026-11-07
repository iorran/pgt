import { parseCsv, parseModalities, normalizeName } from './roster-csv.js';

// Parses the "2027 activo" tab of the academy sheet (Google Sheets CSV export).
// Columns: faixa, MODALIDAD, MOME (name), EMAIL, DATA (birth date), TLF, $$, responsable, familia.

type Belt =
  | 'white' | 'grey-white' | 'grey' | 'yellow' | 'orange-white' | 'orange' | 'green'
  | 'blue' | 'purple' | 'brown' | 'black';

export interface ActiveRosterStudent {
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  belt: Belt;
  price: string;
  trainingNote: string | null;
  modalities: string[];
  family: string | null;
}

export const isActiveRosterCsv = (text: string) => parseCsv(text).some((r) => (r[3] ?? '').trim().toUpperCase() === 'EMAIL');

// Portuguese belt names as typed in the sheet (incl. Spanish "blanco", typos like "amarelha").
const BELTS: Record<string, Belt> = {
  branca: 'white', cinza: 'grey', 'cinza-blanco': 'grey-white', 'cinza-branca': 'grey-white',
  amarela: 'yellow', amarelha: 'yellow', laranja: 'orange', 'laranja e branca': 'orange-white',
  verde: 'green', azul: 'blue', roxa: 'purple', roxo: 'purple', marron: 'brown', marrom: 'brown', preta: 'black',
};
export const parseBelt = (raw: string): Belt => BELTS[normalizeName(raw)] ?? 'white';

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export function parseBirthDate(raw: string): string | null {
  const s = normalizeName(raw);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? s.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  if (!m) {
    return null;
  }
  const month = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS[m[2]];
  const [day, year] = [Number(m[1]), Number(m[3])];
  const d = new Date(Date.UTC(year, (month ?? 0) - 1, day));
  if (!month || d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
const FAMILY_RE = /^fam[ií]lia\s+/i;

export function parseActiveRoster(text: string): ActiveRosterStudent[] {
  const out: ActiveRosterStudent[] = [];
  for (const r of parseCsv(text)) {
    const name = (r[2] ?? '').replace(/\s+/g, ' ').trim();
    if (!name || ['mome', 'nome'].includes(name.toLowerCase())) {
      continue;
    }
    const responsable = (r[7] ?? '').replace(/\s+/g, ' ').trim();
    const familyCell = (r[8] ?? '').trim() || (FAMILY_RE.test(responsable) ? responsable : '');
    const note = familyCell === responsable ? '' : responsable;
    const modalityText = (r[1] ?? '').trim();
    const digits = (r[5] ?? '').replace(/\D/g, '');
    const amount = Number((r[6] ?? '').replace(/[^\d,.]/g, '').replace(',', '.'));
    out.push({
      name,
      email: (r[3] ?? '').split(/\s+/).find((t) => EMAIL_RE.test(t))?.toLowerCase() ?? null,
      phone: digits.length >= 9 ? digits : null,
      dateOfBirth: parseBirthDate(r[4] ?? ''),
      belt: parseBelt(r[0] ?? ''),
      price: (Number.isFinite(amount) ? amount : 0).toFixed(2),
      trainingNote: [modalityText, note].filter(Boolean).join(' · ') || null,
      modalities: parseModalities(modalityText),
      family: familyCell ? titleCase(familyCell.replace(FAMILY_RE, '').replace(/\s+/g, ' ').trim()) : null,
    });
  }
  return out;
}
