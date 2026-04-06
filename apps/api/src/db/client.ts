import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema/index.js';

const isNeon = env.DATABASE_URL.includes('neon.tech');

export const db = isNeon
  ? drizzleNeon(neon(env.DATABASE_URL), { schema })
  : drizzle(postgres(env.DATABASE_URL), { schema });
