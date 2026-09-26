import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
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

  it('shows a contextual empty state with the owner CTA', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<TournamentsPage />);
    expect(await screen.findByText('tournaments.empty')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'tournaments.createTournament' })).toHaveLength(2);
  });

  it('empty state has no create CTA for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<TournamentsPage />);
    expect(await screen.findByText('tournaments.empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tournaments.createTournament' })).not.toBeInTheDocument();
  });

  it('formats dates without shifting a day', async () => {
    renderWithProviders(<TournamentsPage />);
    expect(await screen.findByText('10/05/2026')).toBeInTheDocument();
  });

  it('pairs create form labels with inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TournamentsPage />);
    await user.click(await screen.findByRole('button', { name: 'tournaments.createTournament' }));
    expect(await screen.findByLabelText('tournaments.tournamentName')).toBeInTheDocument();
    expect(screen.getByLabelText('classes.date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('tournaments.location')).toBeInTheDocument();
    expect(screen.getByLabelText('tournaments.federation')).toBeInTheDocument();
  });
});
