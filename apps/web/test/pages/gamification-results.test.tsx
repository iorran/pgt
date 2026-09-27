import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, renderWithRoute } from '../render';
import ResultsPage from '@/pages/gamification/results';

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

const mockSeasons = [
  { id: 's1', name: 'Season 2026' },
];

const mockPendingResults = [
  { id: 'cr1', competitionName: 'IBJJF Open', date: '2026-03-15', position: 1, status: 'pending', studentName: 'Carlos' },
  { id: 'cr2', competitionName: 'Local Cup', date: '2026-03-20', position: 3, status: 'pending', studentName: 'Ana' },
];

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a student to the ranking', async () => {
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockResolvedValue([] as any);
    renderWithRoute(
      <Routes>
        <Route path="/gamification" element={<p>ranking</p>} />
        <Route path="/gamification/results" element={<ResultsPage />} />
      </Routes>,
      ['/gamification/results'],
    );
    expect(await screen.findByText('ranking')).toBeInTheDocument();
    expect(screen.queryByLabelText('gamification.results.competition')).not.toBeInTheDocument();
  });

  it('owner gets a Registrar resultado button', async () => {
    mockUseSession.mockReturnValue(instructorSession);
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockPendingResults as any);
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    expect(screen.getByRole('button', { name: 'gamification.results.register' })).toBeInTheDocument();
  });

  it('shows pending results for instructor', async () => {
    mockUseSession.mockReturnValue(instructorSession);
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockPendingResults as any);
    renderWithProviders(<ResultsPage />);
    expect(await screen.findByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('IBJJF Open')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Local Cup')).toBeInTheDocument();
  });

  it('shows approve/reject buttons for instructor', async () => {
    mockUseSession.mockReturnValue(instructorSession);
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockPendingResults as any);
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    const approveButtons = screen.getAllByText('gamification.approve');
    const rejectButtons = screen.getAllByText('gamification.reject');
    expect(approveButtons.length).toBe(2);
    expect(rejectButtons.length).toBe(2);
  });

  it('shows an empty state linking to seasons when the owner has none', async () => {
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValueOnce([] as any);
    renderWithProviders(<ResultsPage />);
    expect(await screen.findByText('gamification.noSeasons')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gamification.createSeason' })).toHaveAttribute('href', '/gamification/seasons');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('labels the owner season select and translates positions', async () => {
    mockUseSession.mockReturnValue(instructorSession);
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockPendingResults as any);
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    expect(screen.getByRole('combobox', { name: 'gamification.season' })).toBeInTheDocument();
    expect(screen.getByText('gamification.first')).toBeInTheDocument();
    expect(screen.getByText('gamification.third')).toBeInTheDocument();
    expect(screen.queryByText('1st')).not.toBeInTheDocument();
  });

  it('only the clicked row shows a pending approval', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi
      .mockResolvedValueOnce(mockSeasons as any)
      .mockResolvedValueOnce(mockPendingResults as any)
      .mockReturnValueOnce(new Promise(() => {}));
    renderWithProviders(<ResultsPage />);
    const carlosCard = (await screen.findByText('Carlos')).closest('[data-slot="card"]') as HTMLElement;
    const anaCard = screen.getByText('Ana').closest('[data-slot="card"]') as HTMLElement;
    await user.click(within(carlosCard).getByRole('button', { name: 'gamification.approve' }));
    await waitFor(() => {
      expect(within(carlosCard).getByRole('button', { name: 'gamification.approve' })).toBeDisabled();
    });
    expect(within(anaCard).getByRole('button', { name: 'gamification.approve' })).not.toBeDisabled();
    expect(within(anaCard).getByRole('button', { name: 'gamification.reject' })).not.toBeDisabled();
  });
});
