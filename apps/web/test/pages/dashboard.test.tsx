import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue([] as any);
  });

  it('shows Open Totem card for instructors', async () => {
    renderWithProviders(<DashboardPage />);
    // Explainer text is unique to this card
    await waitFor(() =>
      expect(screen.getByText('totem.openTotemExplainer')).toBeInTheDocument(),
    );
    // Both the title and the button render the key; expect exactly 2 nodes
    expect(screen.getAllByText('totem.openTotem')).toHaveLength(2);
  });

  it('Open Totem button opens /totem in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);
    const button = await screen.findByRole('button', { name: 'totem.openTotem' });
    await user.click(button);
    expect(openSpy).toHaveBeenCalledWith('/totem', '_blank', 'noopener');
    openSpy.mockRestore();
  });

  it('does not render join-code card on dashboard', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText('onboarding.joinCode')).not.toBeInTheDocument();
      expect(screen.queryByText('onboarding.copyCode')).not.toBeInTheDocument();
      expect(screen.queryByText('onboarding.shareWhatsApp')).not.toBeInTheDocument();
    });
  });
});
