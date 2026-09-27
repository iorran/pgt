import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from './client.js';
import { academy, season, user } from './schema/index.js';
import { parseRanking, matchStudent, isPromotion } from './ranking-csv.js';
import { carryOverPoints } from '../gamification/carried-points.js';

// Imports the academy's ranking sheet: sets belts and carries over each student's points into the
// season covering DATE (one "Pontos acumulados" entry each). Only unambiguous name matches are used;
// everything else is listed for the owner to fix in the app. Safe to re-run (no duplicate points).
// Dry run by default. Usage: [RANKING_CSV=…] [ACADEMY_SLUG=…] [LABEL=…] [DATE=YYYY-MM-DD] [APPLY=1] npm run db:import-ranking
const file = process.env.RANKING_CSV || 'seed-data/ranking-2026.csv';
const slug = process.env.ACADEMY_SLUG || 'pgt-pontinha';
const label = process.env.LABEL || 'Pontos acumulados até a Mafra Cup';
const date = process.env.DATE || new Date().toISOString().slice(0, 10);
const apply = process.env.APPLY === '1';

async function main() {
  const [acad] = await db.select({ id: academy.id, ownerId: academy.ownerId }).from(academy).where(eq(academy.slug, slug));
  if (!acad || !acad.ownerId) {
    throw new Error(`No academy ${slug} (or it has no owner)`);
  }
  const [targetSeason] = await db.select({ id: season.id, name: season.name }).from(season)
    .where(and(eq(season.academyId, acad.id), lte(season.startDate, date), gte(season.endDate, date)))
    .orderBy(desc(season.startDate))
    .limit(1);
  if (!targetSeason) {
    throw new Error(`No season covers ${date} — create one in Ranking → Temporadas first`);
  }
  const students = await db
    .select({ id: user.id, name: user.name, belt: user.belt })
    .from(user)
    .where(and(eq(user.academyId, acad.id), eq(user.role, 'student')));

  const rows = parseRanking(readFileSync(file, 'utf8'));
  const changes: { id: string; name: string; from: string; to: NonNullable<(typeof rows)[number]['belt']> }[] = [];
  const review: string[] = [];
  const points: { studentId: string; name: string; points: number }[] = [];

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
      if (row.points > 0) {
        points.push({ studentId: current.id, name: current.name, points: row.points });
      }
      if (isPromotion(current.belt, row.belt)) {
        changes.push({ id: current.id, name: current.name, from: current.belt, to: row.belt });
      }
    }
  }

  console.log(`${rows.length} ranking rows, ${changes.length} belt changes${apply ? '' : ' (dry run)'}:`);
  for (const c of changes) {
    console.log(`  ✓ ${c.name}: ${c.from} → ${c.to}`);
  }
  console.log(`\n${points.length} students get "${label}" in season ${targetSeason.name}:`);
  for (const p of points) {
    console.log(`  + ${p.name}: ${p.points} pts`);
  }
  if (review.length) {
    console.log(`\nFix these in the app (student name / Faixa), then re-run to import their points:`);
    review.forEach((line) => console.log(`  ${line}`));
  }

  if (apply) {
    for (const c of changes) {
      await db.update(user).set({ belt: c.to, updatedAt: new Date() }).where(eq(user.id, c.id));
    }
    const result = await carryOverPoints({
      seasonId: targetSeason.id,
      ownerId: acad.ownerId,
      label,
      date,
      entries: points.map(({ studentId, points: p }) => ({ studentId, points: p })),
    });
    console.log(`\nApplied ${changes.length} belt changes; points: ${result.created} added, ${result.skipped} already there.`);
  } else {
    console.log('\nNothing written. Re-run with APPLY=1 to apply.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message ?? e);
  process.exit(1);
});
