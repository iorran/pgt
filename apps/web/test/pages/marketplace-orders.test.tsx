import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import OrdersPage from '@/pages/marketplace/orders';
import { formatDate } from '@/lib/format';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const ownerSession = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const orders = [
  { id: 'o1', productName: 'Gi', studentName: 'Ana', quantity: 1, status: 'requested', createdAt: '2026-04-23T10:00:00.000Z' },
];

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(ownerSession);
    mockApi.mockResolvedValue(orders as any);
  });

  it('styles requested status as warning and formats the date', async () => {
    renderWithProviders(<OrdersPage />);
    const badge = await screen.findByText('marketplace.orderStatus.requested');
    expect(badge.className).toMatch(/yellow/);
    expect(screen.getByText(formatDate('2026-04-23', 'pt-BR'))).toBeInTheDocument();
  });

  it('asks for confirmation before cancelling an order', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrdersPage />);
    await screen.findByText('Gi');
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    const dialog = await screen.findByRole('dialog');
    expect(mockApi).not.toHaveBeenCalledWith('/orders/o1/status', expect.anything());
    await user.click(within(dialog).getByRole('button', { name: 'marketplace.cancelOrder' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/orders/o1/status',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }),
      );
    });
  });

  it('shows a contextual empty state', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<OrdersPage />);
    expect(await screen.findByText('marketplace.noOrders')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'marketplace.browseProducts' })).toBeInTheDocument();
  });
});
