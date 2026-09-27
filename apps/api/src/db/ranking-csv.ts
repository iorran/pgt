// Parses the academy's ranking sheet (Google Sheets CSV): _, "Faixa - Categoría", Nome, Puntos.
import { parseCsv, normalizeName } from './roster-csv.js';
import { beltEnum } from './schema/user.js';

export type Belt = (typeof beltEnum.enumValues)[number];

const COLORS: Record<string, string> = {
  branca: 'white', cinza: 'grey', amarela: 'yellow', amarelha: 'yellow', laranja: 'orange',
  verde: 'green', azul: 'blue', roxa: 'purple', marrom: 'brown', marron: 'brown', preta: 'black',
};
const KIDS_COLORS = new Set(['grey', 'yellow', 'orange', 'green']);

const stripEmoji = (s: string) => s.replace(/\p{Extended_Pictographic}|️/gu, '');

// "laranja é branca - kids" → orange-white; "PRETA - MASTER" → black. The category part is ignored.
export function parseBeltText(text: string): Belt | null {
  const colors = normalizeName(stripEmoji(text))
    .split(/[^a-z]+/)
    .map((w) => COLORS[w])
    .filter(Boolean);
  const [main, second] = colors;
  if (!main) {
    return null;
  }
  // Kids two-tone belts: "<colour> e branca/preta".
  if (KIDS_COLORS.has(main) && (second === 'white' || second === 'black')) {
    return `${main}-${second}` as Belt;
  }
  return main as Belt;
}

export interface RankingRow {
  name: string;
  beltText: string;
  belt: Belt | null;
  points: number;
}

export function parseRanking(text: string): RankingRow[] {
  return parseCsv(text)
    .slice(2) // title + header
    .map((r) => ({
      name: stripEmoji(r[2] ?? '').replace(/\s+/g, ' ').trim(),
      beltText: stripEmoji(r[1] ?? '').trim(),
      points: Number(r[3]),
    }))
    .filter((r) => r.name)
    .map((r) => ({
      name: r.name,
      beltText: r.beltText,
      belt: parseBeltText(r.beltText),
      points: Number.isFinite(r.points) ? r.points : 0,
    }));
}

type Candidate = { id: string; name: string };
export type Match =
  | { status: 'ok'; student: Candidate }
  | { status: 'ambiguous'; candidates: Candidate[] }
  | { status: 'none' };

// Exact name (case/accent-insensitive) first; otherwise every word of the sheet name must appear in exactly
// one student's name. Never guesses between several candidates.
export function matchStudent(name: string, students: Candidate[]): Match {
  const target = normalizeName(name);
  const exact = students.filter((s) => normalizeName(s.name) === target);
  const words = target.split(' ');
  const hits = exact.length
    ? exact
    : students.filter((s) => {
        const studentWords = normalizeName(s.name).split(' ');
        return words.every((w) => studentWords.includes(w));
      });
  if (hits.length === 1) {
    return { status: 'ok', student: hits[0] };
  }
  return hits.length ? { status: 'ambiguous', candidates: hits } : { status: 'none' };
}
