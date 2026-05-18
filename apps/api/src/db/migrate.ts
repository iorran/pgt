/**
 * Custom migrate script that applies each Drizzle migration file in its own
 * autocommit connection. This is required because:
 *
 * - Migration 0006 uses `ALTER TYPE ... ADD VALUE 'owner'`
 * - Migration 0008 uses `'owner'` in an UPDATE statement
 * - PostgreSQL error 55P04: a newly-added enum value cannot be used in the
 *   same transaction that added it
 * - drizzle-kit migrate wraps ALL pending migrations in a single transaction,
 *   which triggers the error on a fresh install (all 9 migrations pending)
 *
 * This script applies each migration individually, committing between them.
 */

import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import fs from 'node:fs';
import crypto from 'node:crypto';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(process.cwd(), 'drizzle');
const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  entries: JournalEntry[];
}

async function runMigrations() {
  const journalPath = `${MIGRATIONS_DIR}/meta/_journal.json`;
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  // Each migration runs in its own top-level client connection (autocommit).
  // This ensures ALTER TYPE ... ADD VALUE commits before the next migration
  // can use the new enum value.
  for (const entry of journal.entries) {
    const sql_file = `${MIGRATIONS_DIR}/${entry.tag}.sql`;
    const query = fs.readFileSync(sql_file, 'utf8');
    const hash = crypto.createHash('sha256').update(query).digest('hex');

    // Open a fresh autocommit connection per migration
    const client = postgres(databaseUrl!, { max: 1 });

    try {
      // Ensure migration tracking schema/table exist
      await client`CREATE SCHEMA IF NOT EXISTS ${client(MIGRATIONS_SCHEMA)}`;
      await client.unsafe(`
        CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      // Check if already applied
      const rows = await client`
        SELECT hash FROM ${client(MIGRATIONS_SCHEMA)}.${client(MIGRATIONS_TABLE)}
        WHERE created_at = ${entry.when}
      `;
      if (rows.length > 0) {
        console.log(`  [skip] ${entry.tag} (already applied)`);
        continue;
      }

      console.log(`  [run]  ${entry.tag}`);

      // Split on breakpoints and run each statement
      const statements = query
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await client.unsafe(stmt);
      }

      // Record the migration
      await client`
        INSERT INTO ${client(MIGRATIONS_SCHEMA)}.${client(MIGRATIONS_TABLE)} (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
    } finally {
      await client.end();
    }
  }
}

runMigrations()
  .then(() => {
    console.log('Migrations complete!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
