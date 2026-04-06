import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('resend', () => {
  const mockSend = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
    __mockSend: mockSend,
  };
});

import { ResendEmailProvider } from '../../src/email/resend-provider.js';

describe('ResendEmailProvider', () => {
  let provider: ResendEmailProvider;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const resendModule = await import('resend') as any;
    mockSend = resendModule.__mockSend;
    provider = new ResendEmailProvider('re_test_key', 'PGT <noreply@pgt.app>');
  });

  it('calls resend emails.send with correct params', async () => {
    mockSend.mockResolvedValue({ data: { id: '123' }, error: null });

    await provider.send({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'PGT <noreply@pgt.app>',
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });
  });

  it('throws when resend returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });

    await expect(
      provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('Failed to send email: Invalid API key');
  });
});
