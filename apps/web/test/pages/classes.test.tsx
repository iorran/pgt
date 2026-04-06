import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import ClassesPage from '@/pages/classes/index';

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

const mockClasses = [
  { id: 'c1', name: 'Morning Gi', type: 'gi', dayOfWeek: 1, startTime: '07:00', endTime: '08:30', instructor: 'Prof Silva' },
  { id: 'c2', name: 'No-Gi Night', type: 'no-gi', dayOfWeek: 3, startTime: '19:00', endTime: '20:30' },
];

describe('ClassesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockClasses as any);
  });

  it('renders page title', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.title')).toBeInTheDocument();
    });
  });

  it('shows class cards after API fetch', async () => {
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByText('No-Gi Night')).toBeInTheDocument();
    expect(screen.getByText('07:00 - 08:30')).toBeInTheDocument();
    expect(screen.getByText('Prof Silva')).toBeInTheDocument();
  });

  it('shows create button for instructors', async () => {
    renderWithProviders(<ClassesPage />);
    await waitFor(() => {
      expect(screen.getByText('classes.createClass')).toBeInTheDocument();
    });
  });

  it('shows check-in button for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);
    const buttons = await screen.findAllByText('classes.checkin');
    expect(buttons.length).toBe(2);
  });

  it('shows empty state when no classes', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<ClassesPage />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });
});
