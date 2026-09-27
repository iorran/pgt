import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { competitionResult, xpEntry } from '../db/schema/index.js';
import { xpForResult } from './points.js';

type Executor = Pick<typeof db, 'update' | 'insert' | 'delete'>;
type ResultChanges = Partial<Omit<typeof competitionResult.$inferInsert, 'id'>>;

// The one place a result's points change (decision 4): a result that is not approved has 0 points,
// and its XP entry follows its points — exactly one per approved result, none otherwise.
export async function saveResult(id: string, changes: ResultChanges, exec?: Executor): Promise<typeof competitionResult.$inferSelect> {
  if (!exec) {
    return db.transaction((tx) => saveResult(id, changes, tx));
  }
  let [row] = await exec.update(competitionResult).set(changes).where(eq(competitionResult.id, id)).returning();
  if (row.status !== 'approved' && row.pointsAwarded !== 0) {
    [row] = await exec.update(competitionResult).set({ pointsAwarded: 0 }).where(eq(competitionResult.id, id)).returning();
  }
  await exec.delete(xpEntry).where(and(eq(xpEntry.sourceType, 'competition'), eq(xpEntry.sourceId, id)));
  const xp = xpForResult(row);
  if (xp !== null) {
    await exec.insert(xpEntry).values({ studentId: row.studentId, xpAmount: xp, sourceType: 'competition', sourceId: id });
  }
  return row;
}
