import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import SeasonsPage from '@/pages/gamification/seasons';

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

describe('SeasonsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(ownerSession);
  });

  it('shows an empty state with the create CTA for owners', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<SeasonsPage />);
    expect(await screen.findByText('gamification.noSeasons')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'gamification.createSeason' })).toHaveLength(2);
  });

  it('formats season dates without shifting a day', async () => {
    mockApi.mockResolvedValue([
      { id: 's1', name: 'S1', startDate: '2026-01-01', endDate: '2026-06-30', active: true },
    ] as any);
    renderWithProviders(<SeasonsPage />);
    expect(await screen.findByText('01/01/2026 - 30/06/2026')).toBeInTheDocument();
  });

  it('pairs form labels with inputs and bounds end date by start date', async () => {
    const user = userEvent.setup();
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<SeasonsPage />);
    const [trigger] = await screen.findAllByRole('button', { name: 'gamification.createSeason' });
    await user.click(trigger);
    expect(await screen.findByLabelText('gamification.seasonName')).toBeInTheDocument();
    expect(screen.getByLabelText('gamification.prize')).toBeInTheDocument();
    expect(screen.getByLabelText('gamification.first')).toHaveAttribute('type', 'number');
    await user.type(screen.getByLabelText('gamification.startDate'), '2026-03-01');
    expect(screen.getByLabelText('gamification.endDate')).toHaveAttribute('min', '2026-03-01');
  });
});
