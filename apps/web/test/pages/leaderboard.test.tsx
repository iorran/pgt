import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import LeaderboardPage from '@/pages/gamification/leaderboard';

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
  data: { user: { id: 'u1', name: 'Test', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockSeasons = [
  { id: 's1', name: 'Season 2026', startDate: '2026-01-01', endDate: '2026-06-30' },
];

const mockEntries = [
  { rank: 1, name: 'Champion', belt: 'black', totalPoints: 500 },
  { rank: 2, name: 'Runner Up', belt: 'brown', totalPoints: 400 },
  { rank: 3, name: 'Third Place', belt: 'purple', totalPoints: 350 },
  { rank: 4, name: 'Fourth', belt: 'blue', totalPoints: 200 },
];

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    // First call: seasons, second call: leaderboard entries
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockEntries as any);
  });

  it('renders the big RANKING title', async () => {
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByText('gamification.leaderboardPageTitle')).toBeInTheDocument();
    });
  });

  it('shows category tabs (kids/adults)', async () => {
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByText('gamification.adults')).toBeInTheDocument();
      expect(screen.getByText('gamification.kids')).toBeInTheDocument();
    });
  });

  it('renders ranked entries after fetch', async () => {
    renderWithProviders(<LeaderboardPage />);
    expect(await screen.findByText('Champion')).toBeInTheDocument();
    expect(screen.getByText('Runner Up')).toBeInTheDocument();
    expect(screen.getByText('Third Place')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();
  });

  it('shows gold/silver/bronze styling for top 3', async () => {
    renderWithProviders(<LeaderboardPage />);
    await screen.findByText('Champion');

    const rank1 = screen.getByText('#1');
    const rank2 = screen.getByText('#2');
    const rank3 = screen.getByText('#3');

    expect(rank1.className).toContain('text-arena-gold');
    expect(rank2.className).toContain('text-arena-silver');
    expect(rank3.className).toContain('text-arena-bronze');
  });

  it('shows empty state', async () => {
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce([] as any);
    renderWithProviders(<LeaderboardPage />);
    // The empty state is inside the active TabsContent
    const elements = await screen.findAllByText('gamification.noResultsYet');
    expect(elements.length).toBeGreaterThan(0);
  });
});
