import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const academy = {
  id: 'a1',
  name: 'Test Academy',
  city: 'Lisbon',
  latitude: null,
  longitude: null,
  address: null,
  joinCode: 'ABC123',
};

const instructorSession = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(academy as any);
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
      ...academy,
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

  it('renders the join code for instructors', async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });
  });

  it('copy button writes join code to clipboard', async () => {
    // userEvent.setup() installs its own Clipboard on navigator; spy after setup
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.copyCode' });
    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith('ABC123');
    writeText.mockRestore();
  });

  it('WhatsApp share opens a wa.me link with the join URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const btn = await screen.findByRole('button', { name: 'onboarding.shareWhatsApp' });
    await user.click(btn);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=.*ABC123/),
      '_blank',
    );
    openSpy.mockRestore();
  });
});
