import { describe, it, expect } from 'vitest';
import { clientIp } from '../../src/utils/client-ip';

const SECRET = 's3cret-value';

describe('clientIp', () => {
  it('trusts the visitor IP Vercel sets when the origin secret matches', () => {
    const h = { 'x-origin-secret': SECRET, 'x-real-ip': '203.0.113.7', 'fly-client-ip': '76.76.21.1' };
    expect(clientIp(h, '10.0.0.1', SECRET)).toBe('203.0.113.7');
  });

  it('falls back to Fly-Client-IP when the secret is wrong or missing', () => {
    expect(clientIp({ 'x-origin-secret': 'nope', 'x-real-ip': '1.2.3.4', 'fly-client-ip': '198.51.100.9' }, '10.0.0.1', SECRET)).toBe('198.51.100.9');
    expect(clientIp({ 'x-real-ip': '1.2.3.4', 'fly-client-ip': '198.51.100.9' }, '10.0.0.1', SECRET)).toBe('198.51.100.9');
  });

  it('never trusts a client-supplied X-Forwarded-For', () => {
    expect(clientIp({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, '10.0.0.1', SECRET)).toBe('10.0.0.1');
  });

  it('ignores the secret header when no secret is configured', () => {
    expect(clientIp({ 'x-origin-secret': '', 'x-real-ip': '1.2.3.4', 'fly-client-ip': '198.51.100.9' }, '10.0.0.1', '')).toBe('198.51.100.9');
  });

  it('uses the socket address when nothing else is available', () => {
    expect(clientIp({}, '127.0.0.1', SECRET)).toBe('127.0.0.1');
  });
});
