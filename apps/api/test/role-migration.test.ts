import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb, cleanDb } from './helpers.js';

describe('user_role enum after migration 0008', () => {
  beforeEach(async () => { await cleanDb(); });
  it('contains exactly student, owner', async () => {
    const rows = await testDb.execute(sql`
      SELECT e.enumlabel AS label
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' ORDER BY 1
    `);
    const labels = (rows as unknown as { label: string }[]).map(r => r.label).sort();
    expect(labels).toEqual(['owner', 'student']);
  });

  it('rejects inserting role = instructor', async () => {
    await expect(
      testDb.execute(sql`
        INSERT INTO "user" (email, name, role)
        VALUES ('x@x.com', 'X', 'instructor'::user_role)
      `),
    ).rejects.toThrow();
  });
});
