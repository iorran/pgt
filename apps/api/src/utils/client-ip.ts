import { timingSafeEqual } from 'node:crypto';

type IncomingHeaders = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

function sameSecret(sent: string, expected: string) {
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The visitor's IP for rate limiting. X-Forwarded-For is never trusted as sent: anyone can reach the
// Fly app directly and set it. Vercel's x-real-ip is trusted only when the request carries the origin
// secret that the Vercel rewrite adds; otherwise Fly-Client-IP (set by Fly's edge) or the socket.
export function clientIp(headers: IncomingHeaders, remoteAddress: string | undefined, secret: string) {
  const sent = one(headers['x-origin-secret']);
  if (secret && sent && sameSecret(sent, secret)) {
    const visitor = one(headers['x-real-ip']);
    if (visitor) {
      return visitor;
    }
  }
  return one(headers['fly-client-ip']) ?? remoteAddress ?? '127.0.0.1';
}
