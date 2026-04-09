import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { user, session } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function devRoutes(app: FastifyInstance) {
  app.get('/impersonate', async (request, reply) => {
    // Guard: fail closed with 404 to hide endpoint existence in non-dev environments
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.DEV_AUTH_BYPASS !== '1'
    ) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Query validation
    const { email } = request.query as { email?: string };
    if (!email || email.trim() === '') {
      return reply.status(400).send({ error: 'email query param required' });
    }

    // Look up user by email
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!foundUser) {
      return reply.status(404).send({ error: 'user not found' });
    }

    // Delete any existing sessions for that user (fresh impersonation)
    await db.delete(session).where(eq(session.userId, foundUser.id));

    // Generate cryptographically random token
    const token = crypto.randomBytes(32).toString('hex');

    // Insert new session row
    await db.insert(session).values({
      userId: foundUser.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: (request.ip as string) || null,
      userAgent: (request.headers['user-agent'] as string) || null,
    });

    // Set the session cookie.
    // BetterAuth signs cookies as `<value>.<base64(HMAC-SHA256(value, secret))>`
    // (see node_modules/better-auth/node_modules/better-call/dist/crypto.mjs
    // `signCookieValue`). The final value is URL-encoded. We must produce the
    // same format here so BetterAuth's `getSignedCookie` verification passes.
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      return reply
        .status(500)
        .send({ error: 'BETTER_AUTH_SECRET not set' });
    }
    const signature = crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('base64');
    const signedValue = `${token}.${signature}`;
    reply.setCookie('better-auth.session_token', signedValue, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.status(200).send({
      ok: true,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
        academyId: foundUser.academyId,
        status: foundUser.status,
      },
    });
  });
}
