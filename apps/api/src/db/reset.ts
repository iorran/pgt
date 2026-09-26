import postgres from 'postgres';
import { env } from '../env.js';

// Wipes ALL data: drops the public schema and drizzle's migration journal
// (without the latter, `drizzle-kit migrate` thinks tables exist and skips them).
// Follow with `npm run db:migrate && npm run db:seed`.
const host = new URL(env.DATABASE_URL).host;
if (!process.argv.includes('--yes')) {
  console.error(`Refusing to wipe ${host} without --yes`);
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1 });
await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await sql.end();
console.log(`Wiped ${host}`);
