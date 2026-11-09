// The in-app help reads the user guides straight from the Obsidian vault (docs/), so there is one
// source to edit. Each Portuguese line may be followed by its English translation as
// `<sub><em>…</em></sub>`; we keep one language and split the guide on its `##` headings.
import ownerGuide from '../../../../docs/User Guide - Instructor.md?raw';
import studentGuide from '../../../../docs/User Guide - Student.md?raw';

export type GuideKind = 'owner' | 'student';
export const GUIDES: Record<GuideKind, string> = { owner: ownerGuide, student: studentGuide };

export interface GuideSection {
  /** The Portuguese heading: stable across languages, used in links (`#Famílias`). */
  id: string;
  title: string;
  body: string;
}

const SUB = /^\s*(?:>\s*)?<sub><em>(.*)<\/em><\/sub>\s*$/;
const PREFIX = /^(\s*(?:#{1,6} |> |[-*] |\d+\. )?)/;
const CALLOUT = /^> \[!\w+\][+-]?\s*(.*)$/;

export function parseGuide(markdown: string, language: string) {
  const en = language.startsWith('en');
  const lines = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const intro: string[] = [];
  const sections: GuideSection[] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) {
      sections.push({ id: current.id, title: current.title, body: current.lines.join('\n') });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const orphanSub = line.match(SUB);
    if (orphanSub) {
      // A subtitle with no Portuguese line above it (rare): show it only in English.
      if (en) {
        (current?.lines ?? intro).push(orphanSub[1]);
      }
      continue;
    }
    const sub = lines[i + 1]?.match(SUB);
    if (sub) {
      i++;
    }
    const translated = en && sub ? line.match(PREFIX)![1] + sub[1] : line;

    if (line.startsWith('# ')) {
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      flush();
      current = { id: h2[1].trim(), title: translated.slice(3).trim(), lines: [] };
      continue;
    }
    const callout = line.match(CALLOUT);
    const calloutTitle = callout && (en && sub ? sub[1] : callout[1]);
    (current?.lines ?? intro).push(callout ? (calloutTitle ? `> **${calloutTitle}**` : '>') : translated);
  }
  flush();
  return { intro: intro.join('\n'), sections };
}

/** A link target is a `##` id or a `###` heading inside a section. */
export function findSection(sections: GuideSection[], target: string) {
  return sections.find((s) => s.id === target) ?? sections.find((s) => s.body.split('\n').some((l) => l.trim() === `### ${target}`));
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function matches(section: GuideSection, query: string) {
  const q = fold(query.trim());
  return fold(section.title).includes(q) || fold(section.body).includes(q);
}

// Screen → guide section for the "?" button. First prefix match wins, so specific paths go first.
const HELP_MAP: Record<GuideKind, [string, string][]> = {
  owner: [
    ['/students/families', 'Famílias'],
    ['/students', 'Gerenciando Alunos'],
    ['/pending', 'Gerenciando Alunos'],
    ['/classes', 'Aulas'],
    ['/billing', 'Financeiro'],
    ['/marketplace', 'Loja'],
    ['/gamification', 'Gamificação'],
    ['/tournaments', 'Campeonatos'],
    ['/settings', 'Primeiros Passos'],
  ],
  student: [
    ['/classes', 'Fazer Check-in nas Aulas'],
    ['/me/billing', 'Pagamentos'],
    ['/me', 'Minha conta'],
    ['/gamification', 'Gamificação'],
    ['/marketplace', 'Loja'],
    ['/tournaments', 'Campeonatos'],
  ],
};

export function helpSectionFor(pathname: string, guide: GuideKind) {
  if (guide === 'owner' && pathname === '/') {
    return 'Painel da Academia';
  }
  return HELP_MAP[guide].find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}
