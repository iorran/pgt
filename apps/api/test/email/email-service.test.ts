import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../../src/email/email-service.js';
import { EmailProvider } from '../../src/email/provider.js';

describe('EmailService', () => {
  let mockProvider: EmailProvider;
  let service: EmailService;

  beforeEach(() => {
    mockProvider = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    service = new EmailService(mockProvider);
  });

  describe('sendPasswordReset', () => {
    it('calls provider.send with correct recipient', async () => {
      await service.sendPasswordReset('user@test.com', 'https://pgt.app/reset?token=abc');

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
        }),
      );
    });

    it('uses the correct subject line', async () => {
      await service.sendPasswordReset('user@test.com', 'https://pgt.app/reset?token=abc');

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'PGT — Recuperação de Senha',
        }),
      );
    });

    it('includes the reset URL in the HTML body', async () => {
      const resetUrl = 'https://pgt.app/reset?token=abc123';
      await service.sendPasswordReset('user@test.com', resetUrl);

      const call = vi.mocked(mockProvider.send).mock.calls[0][0];
      expect(call.html).toContain(resetUrl);
    });

    it('propagates provider errors', async () => {
      vi.mocked(mockProvider.send).mockRejectedValue(new Error('Send failed'));

      await expect(
        service.sendPasswordReset('user@test.com', 'https://pgt.app/reset'),
      ).rejects.toThrow('Send failed');
    });
  });
});
