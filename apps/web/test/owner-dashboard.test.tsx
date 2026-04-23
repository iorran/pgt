import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

const renderPage = async () => {
  const { default: OwnerDashboardPage } = await import('@/pages/owner/dashboard');
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/owner/dashboard']}><OwnerDashboardPage /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('OwnerDashboardPage', () => {
  beforeEach(async () => {
    const { useSession } = await import('@/lib/auth-client');
    const { api } = await import('@/lib/api');
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'own-1', role: 'owner', academyId: 'aca-1' } } } as any);
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/owner/classes/aderencia')) {
        return { period: 'week', from: '2026-04-20', to: '2026-04-27', classes: [
          { classId: 'cls-1', name: 'No-Gi', type: 'no-gi', totalCheckins: 10, uniqueStudents: 8, occurrences: 1, avgPerOccurrence: 10, trend: 1.2 },
        ]};
      }
      if (path === '/owner/students') {
        return { students: [
          { id: 'stu-1', name: 'João', belt: 'blue', lastCheckinAt: '2026-04-21T18:00:00Z', daysSinceCheckin: 2, status: 'active' },
        ]};
      }
      return {};
    });
  });

  it('renders the three sections with data when the user is an owner', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('No-Gi')).toBeInTheDocument());
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
  });

  it('renders a 403 notice for non-owner roles', async () => {
    const { useSession } = await import('@/lib/auth-client');
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'stu-1', role: 'student' } } } as any);
    await renderPage();
    expect(screen.getByText(/forbidden|403/i)).toBeInTheDocument();
  });
});
