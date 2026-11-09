import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CheckinHistoryPage from '@/pages/classes/checkin';
import { api } from '@/lib/api';

let role = 'student';
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'stu-1', role } } }),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(async () => [{
    id: 'ck-1',
    checkedInAt: '2026-04-22T23:30:00.000Z',
    date: '2026-04-23',
    class: { id: 'cls-1', name: 'No-Gi Mon 19:00', type: 'no-gi' },
  }]),
}));

describe('CheckinHistoryPage', () => {
  beforeEach(() => {
    role = 'student';
    vi.mocked(api).mockClear();
  });

  it('renders the class name and the TZ-aware date, not the raw classId', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CheckinHistoryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('No-Gi Mon 19:00')).toBeInTheDocument());
    expect(screen.getByText('2026-04-23')).toBeInTheDocument();
    expect(screen.queryByText('cls-1')).toBeNull();
    expect(screen.queryByText('Invalid Date')).toBeNull();
  });

  it('shows a contextual empty state linking to the class schedule', async () => {
    vi.mocked(api).mockResolvedValueOnce([]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CheckinHistoryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('classes.noCheckins')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'classes.viewSchedule' })).toHaveAttribute('href', '/classes');
  });

  it('shows the owner every student check-in of the academy', async () => {
    role = 'owner';
    vi.mocked(api).mockResolvedValueOnce([{
      id: 'ck-2',
      checkedInAt: '2026-04-22T23:30:00.000Z',
      date: '2026-04-23',
      student: { id: 'stu-9', name: 'Ana Souza' },
      class: { id: 'cls-1', name: 'No-Gi Mon 19:00', type: 'no-gi' },
    }]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CheckinHistoryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', '/students/stu-9');
    expect(screen.getByRole('columnheader', { name: 'classes.student' })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/checkins/academy');
  });

  it('gives the owner an empty state about students, not about themself', async () => {
    role = 'owner';
    vi.mocked(api).mockResolvedValueOnce([]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><CheckinHistoryPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('classes.noAcademyCheckins')).toBeInTheDocument();
  });
});
