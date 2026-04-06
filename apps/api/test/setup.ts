import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export async function setup() {
  // Force test DB
  const testDbUrl = 'postgresql://postgres:postgres@localhost:5433/pgt_test';
  process.env.DATABASE_URL = testDbUrl;

  // Run migrations
  const connection = postgres(testDbUrl, { max: 1 });
  const db = drizzle(connection);
  await migrate(db, { migrationsFolder: resolve(__dirname, '../drizzle') });
  await connection.end();
}

export async function teardown() {
  // Nothing needed — tmpfs DB is ephemeral
}
