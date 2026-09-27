import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../render';
import GamificationProfilePage from '@/pages/gamification/profile';

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
  data: { user: { id: 'u1', name: 'Test', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockProfile = {
  // Real API shape: GET /api/gamification/profile/:id (xp is a SUM, so it arrives as a string)
  xp: '1250',
  streak: { currentStreak: 7, longestStreak: 14 },
  badges: [
    { id: 'b1', name: 'First Class', description: 'Attended first class', earnedAt: '2026-01-15' },
    { id: 'b2', name: 'Streak Master', description: '7 day streak', earnedAt: '2026-02-01' },
  ],
};

const mockMine = [
  { id: 'r1', competitionName: 'Open Lisboa', competitionDate: '2026-09-20', position: 1, status: 'pending', pointsAwarded: 0, seasonName: 'S26' },
  { id: 'r2', competitionName: 'Copa Porto', competitionDate: '2026-08-10', position: 2, status: 'approved', pointsAwarded: 7, seasonName: 'S26' },
  { id: 'r3', competitionName: 'Taça Braga', competitionDate: '2026-07-05', position: 3, status: 'rejected', pointsAwarded: 0, seasonName: 'S26' },
];

function mockApiFor(profile: unknown, mine: unknown) {
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/competition-results/mine') {
      return mine as any;
    }
    return profile as any;
  });
}

describe('GamificationProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApiFor(mockProfile, []);
  });

  it('shows XP total once', async () => {
    renderWithProviders(<GamificationProfilePage />);
    await waitFor(() => {
      expect(screen.getAllByText('gamification.totalXp')).toHaveLength(1);
    });
    // totalXp is rendered with toLocaleString, check for the value
    expect(screen.getByText(/^1[.,\s\u00a0]?250$/)).toBeInTheDocument();
  });

  it('shows streak info', async () => {
    renderWithProviders(<GamificationProfilePage />);
    await waitFor(() => {
      expect(screen.getByText('gamification.currentStreak')).toBeInTheDocument();
      expect(screen.getByText('gamification.longestStreak')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
    });
  });

  it('shows earned badges', async () => {
    renderWithProviders(<GamificationProfilePage />);
    expect(await screen.findByText('First Class')).toBeInTheDocument();
    expect(screen.getByText('Streak Master')).toBeInTheDocument();
    expect(screen.getByText('Attended first class')).toBeInTheDocument();
  });

  it('students only get Ranking and Profile tabs', async () => {
    renderWithProviders(<GamificationProfilePage />);
    const nav = await screen.findByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/gamification', '/gamification/profile']);
  });

  it('shows empty state for no badges', async () => {
    mockApiFor({ ...mockProfile, badges: [] }, []);
    renderWithProviders(<GamificationProfilePage />);
    expect(await screen.findByText('gamification.noBadges')).toBeInTheDocument();
  });

  it('lists my results with status text', async () => {
    mockApiFor(mockProfile, mockMine);
    renderWithProviders(<GamificationProfilePage />);
    expect(await screen.findByRole('heading', { name: 'gamification.results.mine' })).toBeInTheDocument();
    const pending = (await screen.findByText('Open Lisboa')).closest('li') as HTMLElement;
    expect(within(pending).getByText('20/09/2026')).toBeInTheDocument();
    expect(within(pending).getByText('gamification.results.first')).toBeInTheDocument();
    expect(within(pending).getByText('gamification.results.status.pending')).toBeInTheDocument();
    const approved = screen.getByText('Copa Porto').closest('li') as HTMLElement;
    expect(within(approved).getByText('gamification.results.second')).toBeInTheDocument();
    expect(within(approved).getByText(/gamification.results.status.approved/)).toHaveTextContent('+7 gamification.pointsShort');
    const rejected = screen.getByText('Taça Braga').closest('li') as HTMLElement;
    expect(within(rejected).getByText('gamification.results.status.rejected')).toBeInTheDocument();
  });

  it('shows an empty state with the submit button when I have no results', async () => {
    renderWithProviders(<GamificationProfilePage />);
    expect(await screen.findByText('gamification.results.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'gamification.results.submit' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'gamification.results.submit' })).not.toBeInTheDocument();
  });
});
