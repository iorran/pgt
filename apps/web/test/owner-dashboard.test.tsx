import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  // jsdom has no layout engine, so ResponsiveContainer reports 0x0 and
  // BarChart bails out. Replace it with a fixed-size wrapper that also
  // forces explicit width/height on the underlying chart children so the
  // SVG actually renders.
  const ResponsiveContainer = ({ children }: { children: React.ReactElement }) => {
    const child = React.cloneElement(children, { width: 800, height: 400 });
    return <div style={{ width: 800, height: 400 }}>{child}</div>;
  };
  return { ...actual, ResponsiveContainer };
});

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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /no-gi/i })).toBeInTheDocument(),
    );
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByTestId('aderencia-chart-bar-cls-1')).toBeInTheDocument();
  });

  it('renders a 403 notice for non-owner roles', async () => {
    const { useSession } = await import('@/lib/auth-client');
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'stu-1', role: 'student' } } } as any);
    await renderPage();
    expect(screen.getByText(/forbidden|403/i)).toBeInTheDocument();
  });
});

describe('ClassesList expansion', () => {
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
      if (path.startsWith('/owner/classes/cls-1/occurrences/2026-04-20/roster')) {
        return { classId: 'cls-1', date: '2026-04-20',
          students: [{ id: 'stu-1', name: 'João', belt: 'blue', checkedInAt: '2026-04-20T18:00:00Z', source: 'button' }] };
      }
      if (path.startsWith('/owner/classes/cls-1/occurrences')) {
        return { classId: 'cls-1', occurrences: [{ date: '2026-04-20', checkins: 10, uniqueStudents: 8 }] };
      }
      if (path === '/owner/students') return { students: [] };
      return {};
    });
  });

  it('shows occurrence mini-chart and roster when a class row is clicked', async () => {
    const { default: OwnerDashboardPage } = await import('@/pages/owner/dashboard');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/owner/dashboard']}><OwnerDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    // Wait for the classes list to render the row button (not the XAxis tick label, which is
    // inside an SVG text element, not a button).
    const row = await screen.findByRole('button', { name: /no-gi/i });
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByText('João')).toBeInTheDocument());
    expect(screen.getByTestId('occurrence-chart')).toBeInTheDocument();
  });

  it('shows the trend arrow with percentage', async () => {
    const { default: OwnerDashboardPage } = await import('@/pages/owner/dashboard');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/owner/dashboard']}><OwnerDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    // trend 1.2 → up arrow with +20%
    await waitFor(() => expect(screen.getByText(/↑\s*\+?20%/)).toBeInTheDocument());
  });
});

describe('StudentsList status filter + expansion', () => {
  beforeEach(async () => {
    const { useSession } = await import('@/lib/auth-client');
    const { api } = await import('@/lib/api');
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'own-1', role: 'owner', academyId: 'aca-1' } } } as any);
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/owner/classes/aderencia')) {
        return { period: 'week', from: '2026-04-20', to: '2026-04-27', classes: [] };
      }
      if (path === '/owner/students') return { students: [
        { id: 'stu-1', name: 'João', belt: 'blue', lastCheckinAt: '2026-04-21T18:00:00Z', daysSinceCheckin: 2, status: 'active' },
        { id: 'stu-2', name: 'Maria', belt: 'white', lastCheckinAt: '2026-04-10T18:00:00Z', daysSinceCheckin: 13, status: 'slowing' },
      ]};
      if (path.startsWith('/owner/students/stu-1/history')) return {
        student: { id: 'stu-1', name: 'João', belt: 'blue' },
        checkins: [{ date: '2026-04-21', checkedInAt: '2026-04-21T18:00:00Z', class: { id: 'cls-1', name: 'No-Gi', type: 'no-gi' } }],
        stats: { total: 5, uniqueClasses: 2, currentStreak: 3, longestStreak: 5 },
      };
      return {};
    });
  });

  it('filters students by status chip', async () => {
    const { default: OwnerDashboardPage } = await import('@/pages/owner/dashboard');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/owner/dashboard']}><OwnerDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('João')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^slowing/i }));
    expect(screen.queryByText('João')).toBeNull();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^all/i }));
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });

  it('expands a student row to show stats and history', async () => {
    const { default: OwnerDashboardPage } = await import('@/pages/owner/dashboard');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/owner/dashboard']}><OwnerDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    const row = await screen.findByRole('button', { name: /joão/i });
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByText(/Streak: 3/)).toBeInTheDocument());
    expect(screen.getByText(/Total: 5/)).toBeInTheDocument();
  });
});
