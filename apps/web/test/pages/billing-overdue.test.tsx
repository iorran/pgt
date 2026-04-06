import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import BillingOverduePage from '@/pages/billing/index';

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

const session = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockRecords = [
  { id: 'r1', studentName: 'Carlos', belt: 'blue', planName: 'Monthly', daysOverdue: 5 },
  { id: 'r2', studentName: 'Ana', belt: 'purple', planName: 'Quarterly', daysOverdue: 12 },
];

describe('BillingOverduePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApi.mockResolvedValue(mockRecords as any);
  });

  it('renders page title with count badge', async () => {
    renderWithProviders(<BillingOverduePage />);
    await waitFor(() => {
      expect(screen.getByText('billing.overdueTitle')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows overdue student cards after fetch', async () => {
    renderWithProviders(<BillingOverduePage />);
    expect(await screen.findByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
  });

  it('shows days overdue in each card', async () => {
    renderWithProviders(<BillingOverduePage />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
    const labels = screen.getAllByText('billing.daysOverdue');
    expect(labels.length).toBe(2);
  });

  it('shows empty state when no overdue', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<BillingOverduePage />);
    expect(await screen.findByText('billing.noOverdue')).toBeInTheDocument();
  });
});
