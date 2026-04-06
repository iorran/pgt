import { describe, it, expect } from 'vitest';
import { renderPasswordResetEmail } from '../../../src/email/templates/password-reset.js';

describe('renderPasswordResetEmail', () => {
  const resetUrl = 'https://pgt.app/reset-password?token=abc123';

  it('returns HTML containing the reset URL', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain(resetUrl);
  });

  it('contains the PGT branding', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('PGT');
  });

  it('contains pt-BR text for password reset', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('Recuperação de Senha');
    expect(html).toContain('Redefinir Senha');
  });

  it('contains expiry notice', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('1 hora');
  });

  it('produces valid HTML structure', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
