import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5433/pgt_test';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export async function setup() {
  // Force test DB
  process.env.DATABASE_URL = TEST_DB_URL;

  const sql = postgres(TEST_DB_URL, { max: 1 });
  try {
    await ensureMigrationsTable(sql);

    const journalText = await readFile(
      resolve(__dirname, '../drizzle/meta/_journal.json'),
      'utf8',
    );
    const journal: Journal = JSON.parse(journalText);
    const applied = await getAppliedHashes(sql);

    for (const entry of journal.entries) {
      const filePath = resolve(__dirname, `../drizzle/${entry.tag}.sql`);
      const fileText = await readFile(filePath, 'utf8');
      const hash = createHash('sha256').update(fileText).digest('hex');
      if (applied.has(hash)) {
        continue;
      }

      const statements = fileText
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      // Postgres forbids `ALTER TYPE ... ADD VALUE` inside a transaction block.
      // If a migration file has exactly one such statement, run it directly
      // (auto-commit) instead of wrapping in a transaction, then record the hash.
      const isEnumAddValue =
        statements.length === 1 &&
        /^\s*ALTER\s+TYPE\b/i.test(statements[0]) &&
        /\bADD\s+VALUE\b/i.test(statements[0]);

      if (isEnumAddValue) {
        await sql.unsafe(statements[0]);
        await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
        continue;
      }

      // Each migration file runs as its own transaction, so prior enum/DDL
      // changes from earlier files are already committed and usable here.
      await sql.begin(async (tx) => {
        for (const stmt of statements) {
          await tx.unsafe(stmt);
        }
        await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
      });
    }
  } finally {
    await sql.end();
  }
}

async function ensureMigrationsTable(sql: postgres.Sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
}

async function getAppliedHashes(sql: postgres.Sql): Promise<Set<string>> {
  const rows = await sql<{ hash: string }[]>`SELECT hash FROM drizzle.__drizzle_migrations`;
  return new Set(rows.map((r) => r.hash));
}

export async function teardown() {
  // Nothing needed — tmpfs DB is ephemeral
}
