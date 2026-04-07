import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import SettingsPage from '@/pages/settings';

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
  latitude: null,
  longitude: null,
  address: null,
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockAcademy as any);
  });

  it('shows settings title', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('shows location section for instructor', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('onboarding.setLocation')).toBeInTheDocument();
      expect(screen.getByText('onboarding.useMyLocation')).toBeInTheDocument();
    });
  });

  it('shows no location message when not set', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('onboarding.locationNotSet')).toBeInTheDocument();
    });
  });

  it('shows saved coordinates when location is set', async () => {
    mockApi.mockResolvedValue({
      ...mockAcademy,
      latitude: '-23.5505',
      longitude: '-46.6333',
      address: 'Rua Augusta, 123',
    } as any);
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Rua Augusta, 123')).toBeInTheDocument();
    });
  });

  it('does not show location section for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('nav.settings')).toBeInTheDocument();
    });
    expect(screen.queryByText('onboarding.setLocation')).not.toBeInTheDocument();
  });
});
