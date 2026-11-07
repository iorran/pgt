import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { env } from '../env.js';
import * as schema from '../db/schema/index.js';
import { emailService } from '../email/index.js';
import { and, eq, isNull, ne } from 'drizzle-orm';

// A Dependent never logs in: only their Family's Responsible does (ADR 0004).
async function isDependent(userId: string) {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.family, eq(schema.family.id, schema.user.familyId))
    .where(and(eq(schema.user.id, userId), isNull(schema.family.deletedAt), ne(schema.family.responsibleUserId, userId)));
  return !!row;
}

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
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await emailService.sendPasswordReset(user.email, url);
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session: any) => (await isDependent(session.userId) ? false : { data: session }),
      },
    },
  },
  user: {
    // academyId, role and status are authority: only server routes set them (academies create/join/approve).
    additionalFields: {
      academyId: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: true },
      dateOfBirth: { type: 'string', required: false, input: true },
      belt: { type: 'string', required: false, input: true, defaultValue: 'white' },
      role: { type: 'string', required: false, input: false, defaultValue: 'student' },
      status: { type: 'string', required: false, input: false, defaultValue: 'active' },
    },
  },
});
