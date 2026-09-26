import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../render';
import PendingStudentsPage from '@/pages/pending-students';

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
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockStudents = [
  { id: 's1', name: 'Carlos Silva', email: 'carlos@test.com', belt: 'white' },
  { id: 's2', name: 'Ana Costa', email: 'ana@test.com', belt: 'blue' },
];

describe('PendingStudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApi.mockResolvedValue(mockStudents as any);
  });

  it('renders pending student list', async () => {
    renderWithProviders(<PendingStudentsPage />);
    expect(await screen.findByText('Carlos Silva')).toBeInTheDocument();
    expect(screen.getByText('Ana Costa')).toBeInTheDocument();
    expect(screen.getByText('carlos@test.com')).toBeInTheDocument();
    expect(screen.getByText('ana@test.com')).toBeInTheDocument();
  });

  it('shows approve/reject buttons', async () => {
    renderWithProviders(<PendingStudentsPage />);
    await screen.findByText('Carlos Silva');
    const approveButtons = screen.getAllByText('onboarding.approve');
    const rejectButtons = screen.getAllByText('onboarding.reject');
    expect(approveButtons.length).toBe(2);
    expect(rejectButtons.length).toBe(2);
  });

  it('shows empty state', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<PendingStudentsPage />);
    expect(await screen.findByText('onboarding.noPending')).toBeInTheDocument();
  });

  it('renders a page heading', async () => {
    renderWithProviders(<PendingStudentsPage />);
    await screen.findByText('Carlos Silva');
    expect(screen.getByRole('heading', { level: 1, name: 'nav.students' })).toBeInTheDocument();
  });

  it('only shows loading on the row being approved', async () => {
    renderWithProviders(<PendingStudentsPage />);
    await screen.findByText('Carlos Silva');
    mockApi.mockReturnValue(new Promise(() => {}) as any);
    const [approveCarlos, approveAna] = screen.getAllByRole('button', { name: 'onboarding.approve' });
    fireEvent.click(approveCarlos);
    await waitFor(() => expect(approveCarlos).toBeDisabled());
    expect(approveAna).not.toBeDisabled();
  });

  it('asks for confirmation before rejecting', async () => {
    renderWithProviders(<PendingStudentsPage />);
    await screen.findByText('Carlos Silva');
    fireEvent.click(screen.getAllByRole('button', { name: 'onboarding.reject' })[0]);
    expect(mockApi).not.toHaveBeenCalledWith('/academies/a1/reject/s1', expect.anything());
    fireEvent.click(await screen.findByRole('button', { name: 'common.confirm' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/academies/a1/reject/s1', { method: 'POST' }),
    );
  });
});
