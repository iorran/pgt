import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { db } from './client.js';
import { academy, user } from './schema/index.js';
import { parseRanking, matchStudent } from './ranking-csv.js';

// Sets students' belts from the academy's ranking sheet. Only unambiguous name matches are changed;
// everything else is listed for the owner to fix in the app (student page → Faixa).
// Dry run by default. Usage: [RANKING_CSV=…] [ACADEMY_SLUG=…] [APPLY=1] npm run db:import-belts
const file = process.env.RANKING_CSV || 'seed-data/ranking-2026.csv';
const slug = process.env.ACADEMY_SLUG || 'pgt-pontinha';
const apply = process.env.APPLY === '1';

async function main() {
  const [acad] = await db.select({ id: academy.id }).from(academy).where(eq(academy.slug, slug));
  if (!acad) {
    throw new Error(`No academy ${slug}`);
  }
  const students = await db
    .select({ id: user.id, name: user.name, belt: user.belt })
    .from(user)
    .where(and(eq(user.academyId, acad.id), eq(user.role, 'student')));

  const rows = parseRanking(readFileSync(file, 'utf8'));
  const changes: { id: string; name: string; from: string; to: NonNullable<(typeof rows)[number]['belt']> }[] = [];
  const review: string[] = [];

  for (const row of rows) {
    if (!row.belt) {
      review.push(`? belt not recognised: "${row.beltText}" for ${row.name}`);
      continue;
    }
    const match = matchStudent(row.name, students);
    if (match.status === 'none') {
      review.push(`✗ not found: ${row.name} (${row.belt})`);
    } else if (match.status === 'ambiguous') {
      review.push(`≈ ambiguous: ${row.name} (${row.belt}) → ${match.candidates.map((c) => c.name).join(' | ')}`);
    } else {
      const current = students.find((s) => s.id === match.student.id)!;
      if (current.belt !== row.belt) {
        changes.push({ id: current.id, name: current.name, from: current.belt, to: row.belt });
      }
    }
  }

  console.log(`${rows.length} ranking rows, ${changes.length} belt changes${apply ? '' : ' (dry run)'}:`);
  for (const c of changes) {
    console.log(`  ✓ ${c.name}: ${c.from} → ${c.to}`);
  }
  if (review.length) {
    console.log(`\nFix these in the app (Alunos → aluno → Faixa):`);
    review.forEach((line) => console.log(`  ${line}`));
  }

  if (apply) {
    for (const c of changes) {
      await db.update(user).set({ belt: c.to, updatedAt: new Date() }).where(eq(user.id, c.id));
    }
    console.log(`\nApplied ${changes.length} changes.`);
  } else {
    console.log('\nNothing written. Re-run with APPLY=1 to apply.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message ?? e);
  process.exit(1);
});
