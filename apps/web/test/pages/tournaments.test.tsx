import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import TournamentsPage from '@/pages/tournaments/index';

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

const mockTournaments = [
  { id: 't1', name: 'IBJJF Open', date: '2026-05-10', location: 'Sao Paulo', federation: 'IBJJF' },
  { id: 't2', name: 'Local Championship', date: '2026-06-20', location: 'Rio', federation: 'CBJJ' },
];

describe('TournamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockTournaments as any);
  });

  it('renders tournament cards', async () => {
    renderWithProviders(<TournamentsPage />);
    expect(await screen.findByText('IBJJF Open')).toBeInTheDocument();
    expect(screen.getByText('Local Championship')).toBeInTheDocument();
    expect(screen.getByText('Sao Paulo')).toBeInTheDocument();
    expect(screen.getByText('Rio')).toBeInTheDocument();
  });

  it('shows signup button for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<TournamentsPage />);
    const buttons = await screen.findAllByText('tournaments.signUp');
    expect(buttons.length).toBe(2);
  });

  it('shows create button for instructors', async () => {
    renderWithProviders(<TournamentsPage />);
    await waitFor(() => {
      expect(screen.getByText('tournaments.createTournament')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<TournamentsPage />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });
});
