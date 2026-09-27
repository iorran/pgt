import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { competitionResult, xpEntry } from '../db/schema/index.js';

// Carried-over Points (docs/CONTEXT.md): points earned before the app, entered as one approved
// ranking entry per student with no podium position. Idempotent per season + label + student.
export async function carryOverPoints(input: {
  seasonId: string;
  ownerId: string;
  label: string;
  date: string;
  entries: { studentId: string; points: number }[];
}) {
  let created = 0;
  let skipped = 0;
  for (const { studentId, points } of input.entries) {
    const [existing] = await db
      .select({ id: competitionResult.id })
      .from(competitionResult)
      .where(and(
        eq(competitionResult.seasonId, input.seasonId),
        eq(competitionResult.studentId, studentId),
        eq(competitionResult.competitionName, input.label),
      ));
    if (existing) {
      skipped++;
      continue;
    }
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(competitionResult).values({
        seasonId: input.seasonId,
        studentId,
        competitionName: input.label,
        competitionDate: input.date,
        position: null,
        status: 'approved',
        pointsAwarded: points,
        submittedBy: input.ownerId,
        reviewedBy: input.ownerId,
      }).returning({ id: competitionResult.id });
      await tx.insert(xpEntry).values({ studentId, xpAmount: points * 10, sourceType: 'competition', sourceId: row.id });
    });
    created++;
  }
  return { created, skipped };
}
