import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { renderWithProviders } from './render';
import App from '@/App';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/components/layout/student-shell', () => ({
  StudentShell: () => (
    <div data-testid="student-shell">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/components/layout/staff-shell', () => ({
  StaffShell: () => (
    <div data-testid="staff-shell">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/pages/dashboard', () => ({
  default: () => <div data-testid="dashboard-page" />,
}));
vi.mock('@/pages/classes/index', () => ({
  default: () => <div data-testid="classes-page" />,
}));
vi.mock('@/pages/owner/dashboard', () => ({
  default: () => <div data-testid="owner-dashboard-page" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

function setSession(role: 'student' | 'instructor' | 'owner') {
  mockedUseSession.mockReturnValue({
    data: {
      user: {
        id: 'u1',
        academyId: 'a1',
        role,
        status: 'approved',
      },
    },
    isPending: false,
  } as any);
}

describe('App shell selector', () => {
  beforeEach(() => {
    mockedUseSession.mockReset();
    // BrowserRouter reads window.location; reset to '/' between tests
    // so redirects from earlier cases don't leak into the next.
    window.history.replaceState({}, '', '/');
  });

  it('mounts StudentShell for role=student', () => {
    setSession('student');
    renderWithProviders(<App />);
    expect(screen.getByTestId('student-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('staff-shell')).not.toBeInTheDocument();
  });

  it('mounts StaffShell for role=instructor', () => {
    setSession('instructor');
    renderWithProviders(<App />);
    expect(screen.getByTestId('staff-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('student-shell')).not.toBeInTheDocument();
  });

  it('redirects students from / to /classes (no instructor dashboard)', () => {
    setSession('student');
    renderWithProviders(<App />);
    expect(screen.getByTestId('classes-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  it('shows the dashboard at / for instructors', () => {
    setSession('instructor');
    renderWithProviders(<App />);
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('classes-page')).not.toBeInTheDocument();
  });

  it('shows the owner dashboard at / for owners (no indirection)', async () => {
    setSession('owner');
    renderWithProviders(<App />);
    // OwnerDashboardPage is lazy-loaded, so wait for the Suspense boundary
    // to resolve the chunk.
    expect(
      await screen.findByTestId('owner-dashboard-page'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  // Regression guard for the session-refetch flap. Without the
  // isRefetching check, a transient { data: null, isPending: false }
  // during a background refetch would render the login routes and
  // bounce the URL to /login — yanking the user off their current
  // page. When isRefetching is true, App should show the loading
  // screen instead.
  it('shows the loading screen during a background refetch', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: true,
    } as any);
    renderWithProviders(<App />);
    expect(screen.getByText(/Carregando/)).toBeInTheDocument();
    expect(screen.queryByTestId('student-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staff-shell')).not.toBeInTheDocument();
  });

  it('shows login routes when session is null and no refetch is in flight', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
      isRefetching: false,
    } as any);
    renderWithProviders(<App />);
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('student-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staff-shell')).not.toBeInTheDocument();
  });
});
