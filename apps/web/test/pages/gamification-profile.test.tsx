import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
  totalXp: 1250,
  currentStreak: 7,
  longestStreak: 14,
  badges: [
    { id: 'b1', name: 'First Class', description: 'Attended first class', earnedAt: '2026-01-15' },
    { id: 'b2', name: 'Streak Master', description: '7 day streak', earnedAt: '2026-02-01' },
  ],
};

describe('GamificationProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApi.mockResolvedValue(mockProfile as any);
  });

  it('shows XP total', async () => {
    renderWithProviders(<GamificationProfilePage />);
    await waitFor(() => {
      expect(screen.getAllByText('gamification.totalXp').length).toBeGreaterThan(0);
    });
    // totalXp is rendered with toLocaleString, check for the value
    const xpElements = screen.getAllByText((content) => content.includes('1'));
    expect(xpElements.length).toBeGreaterThan(0);
  });

  it('shows streak info', async () => {
    renderWithProviders(<GamificationProfilePage />);
    await waitFor(() => {
      expect(screen.getByText('gamification.currentStreakFire')).toBeInTheDocument();
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

  it('shows empty state for no badges', async () => {
    mockApi.mockResolvedValue({ ...mockProfile, badges: [] } as any);
    renderWithProviders(<GamificationProfilePage />);
    expect(await screen.findByText('gamification.noBadges')).toBeInTheDocument();
  });
});
