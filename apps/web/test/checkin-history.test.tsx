import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CheckinHistoryPage from '@/pages/classes/checkin';

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { id: 'stu-1', role: 'student' } } }),
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
});
