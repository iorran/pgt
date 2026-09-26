import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRoute } from '../render';
import { StudentPaymentBanner } from '@/components/student-payment-banner';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

describe('StudentPaymentBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', role: 'student' } },
      isPending: false,
    } as any);
    vi.mocked(api).mockResolvedValue({ status: 'overdue', daysOverdue: 5 } as any);
  });

  it('renders overdue as an alert linking to /me/billing', async () => {
    renderWithRoute(<StudentPaymentBanner />, ['/classes']);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('billing.yourPaymentOverdue');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/me/billing');
  });

  it('is hidden on /me/billing itself', async () => {
    renderWithRoute(<StudentPaymentBanner />, ['/me/billing']);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
