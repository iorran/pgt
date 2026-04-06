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
    mockApi.mockResolvedValue(mockAcademy as any);
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

  it('for student: does not show join code management', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<DashboardPage />);
    // Wait for render to settle
    await waitFor(() => {
      expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByText('onboarding.joinCode')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding.shareWhatsApp')).not.toBeInTheDocument();
  });
});
