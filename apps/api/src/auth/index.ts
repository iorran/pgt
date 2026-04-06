import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { randomUUID } from 'node:crypto';
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
  trustedOrigins: env.TRUSTED_ORIGINS,
  advanced: {
    generateId: () => randomUUID(),
    database: {
      generateId: false,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userData: any) => {
          // If signing up with an academyId, set status to pending (needs instructor approval)
          if (userData.academyId) {
            return { data: { ...userData, status: 'pending' } };
          }
          return { data: userData };
        },
      },
    },
  },
  user: {
    additionalFields: {
      academyId: { type: 'string', required: false, input: true },
      phone: { type: 'string', required: false, input: true },
      dateOfBirth: { type: 'string', required: false, input: true },
      belt: { type: 'string', required: false, input: true, defaultValue: 'white' },
      role: { type: 'string', required: false, input: true, defaultValue: 'student' },
      status: { type: 'string', required: false, input: true, defaultValue: 'active' },
    },
  },
});
