import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import DashboardPage from '@/pages/dashboard';

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

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockAcademy = {
  id: 'a1',
  name: 'Fight Arena',
  city: 'Sao Paulo',
  joinCode: 'ABC123',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockImplementation((path: string) => {
      if (path.includes('academies/mine')) return Promise.resolve(mockAcademy as any);
      return Promise.resolve([] as any);
    });
  });

  it('shows welcome message', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
  });

  it('for instructor: shows join code and WhatsApp share button', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
      expect(screen.getByText('onboarding.joinCode')).toBeInTheDocument();
      expect(screen.getByText('onboarding.shareWhatsApp')).toBeInTheDocument();
    });
  });

  it('shows overdue banner for student', async () => {
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockImplementation((path: string) => {
      if (path.includes('my-status')) return Promise.resolve({ status: 'overdue', daysOverdue: 5 } as any);
      return Promise.resolve([] as any);
    });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('billing.yourPaymentOverdue')).toBeInTheDocument();
    });
  });

  it('shows upcoming payment banner for student', async () => {
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockImplementation((path: string) => {
      if (path.includes('my-status')) return Promise.resolve({ status: 'upcoming', daysUntilDue: 2 } as any);
      return Promise.resolve([] as any);
    });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('billing.paymentDueSoon')).toBeInTheDocument();
    });
  });

  it('for student: does not show join code management', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByText('onboarding.joinCode')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding.shareWhatsApp')).not.toBeInTheDocument();
  });
});
