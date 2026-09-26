import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from './client.js';
import { user, account } from './schema/index.js';
import { auth } from '../auth/index.js';

// Sets a user's password directly (recovery when the email can't receive a reset link).
// Usage: EMAIL=… NEW_PASSWORD=… npm run db:set-password
const email = process.env.EMAIL;
const newPassword = process.env.NEW_PASSWORD;

async function main() {
  if (!email || !newPassword || newPassword.length < 8) {
    throw new Error('Set EMAIL and NEW_PASSWORD (at least 8 characters)');
  }
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!u) {
    throw new Error(`No user ${email}`);
  }
  const updated = await db
    .update(account)
    .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
    .where(and(eq(account.userId, u.id), eq(account.providerId, 'credential')))
    .returning({ id: account.id });
  if (updated.length === 0) {
    throw new Error(`${email} has no password login`);
  }
  // Prove it: sign in the same way the app does.
  await auth.api.signInEmail({ body: { email, password: newPassword } });
  console.log(`Password updated for ${email}; sign-in verified.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed:', e.message ?? e);
  process.exit(1);
});
