import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';
import { env } from '../env.js';
import * as schema from '../db/schema/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      academyId: { type: 'string', required: true, input: true },
      phone: { type: 'string', required: false, input: true },
      dateOfBirth: { type: 'string', required: false, input: true },
      belt: { type: 'string', required: false, input: true, defaultValue: 'white' },
      role: { type: 'string', required: false, input: true, defaultValue: 'student' },
    },
  },
});
