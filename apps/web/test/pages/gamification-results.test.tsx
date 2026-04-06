import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
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
  data: { user: { id: 'u1', name: 'Instructor', role: 'instructor', academyId: 'a1', status: 'active' } },
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

  it('shows result submission form for student', async () => {
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockResolvedValueOnce(mockSeasons as any);
    renderWithProviders(<ResultsPage />);
    await waitFor(() => {
      expect(screen.getAllByText('gamification.submitResult').length).toBeGreaterThan(0);
      expect(screen.getByText('gamification.competitionName')).toBeInTheDocument();
    });
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
});
