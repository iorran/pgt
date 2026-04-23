/**
 * One-off backfill: promote any user referenced by `academy.owner_id` to
 * `role = 'owner'`.
 *
 * This is NOT a Drizzle migration. It cannot be — Postgres refuses to use a
 * newly-added enum value (`'owner'`, added in migration 0006) in the same
 * transaction that added it (error 55P04). Any transactional `drizzle-kit
 * migrate` invocation that applies 0006 and then tries to `UPDATE user SET
 * role='owner'` will fail.
 *
 * Run this after deploying migrations, e.g. in a post-deploy hook or
 * manually via `npx tsx apps/api/src/db/backfill-owner-role.ts`. Idempotent —
 * safe to rerun.
 */

import { sql } from 'drizzle-orm';
import { db } from './client.js';
import { user } from './schema/user.js';
import { academy } from './schema/academy.js';

export async function backfillOwnerRole() {
  const result = await db
    .update(user)
    .set({ role: 'owner' })
    .where(
      sql`${user.id} IN (SELECT ${academy.ownerId} FROM ${academy} WHERE ${academy.ownerId} IS NOT NULL)`,
    );
  // postgres-js returns { count } on update; be tolerant of driver shape.
  return (result as unknown as { count?: number }).count ?? 0;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  backfillOwnerRole()
    .then((n) => {
      console.log(`backfill-owner-role: ${n} user(s) promoted to 'owner'`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('backfill-owner-role failed:', e);
      process.exit(1);
    });
}
