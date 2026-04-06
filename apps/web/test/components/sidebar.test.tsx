import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import { Sidebar } from '@/components/layout/sidebar';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

describe('Sidebar', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: 'Test User', role: 'instructor' } },
      isPending: false,
    } as any);
  });

  it('renders PGT branding', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('app.tagline')).toBeInTheDocument();
  });

  it('shows all nav items for instructor', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.classes')).toBeInTheDocument();
    expect(screen.getByText('nav.students')).toBeInTheDocument();
    expect(screen.getByText('onboarding.pendingStudents')).toBeInTheDocument();
    expect(screen.getByText('nav.billing')).toBeInTheDocument();
    expect(screen.getByText('nav.marketplace')).toBeInTheDocument();
    expect(screen.getByText('nav.gamification')).toBeInTheDocument();
    expect(screen.getByText('nav.tournaments')).toBeInTheDocument();
  });

  it('hides instructor-only items for students', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: 'Student', role: 'student' } },
      isPending: false,
    } as any);

    renderWithProviders(<Sidebar />);
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.classes')).toBeInTheDocument();
    expect(screen.queryByText('nav.students')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding.pendingStudents')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.billing')).not.toBeInTheDocument();
    expect(screen.getByText('nav.marketplace')).toBeInTheDocument();
    expect(screen.getByText('nav.gamification')).toBeInTheDocument();
    expect(screen.getByText('nav.tournaments')).toBeInTheDocument();
  });

  it('highlights active link based on current route', () => {
    // BrowserRouter defaults to "/" so dashboard should be active
    renderWithProviders(<Sidebar />);
    const dashboardLink = screen.getByText('nav.dashboard');
    expect(dashboardLink.className).toContain('text-primary');
    expect(dashboardLink.className).toContain('border-primary');

    const classesLink = screen.getByText('nav.classes');
    expect(classesLink.className).toContain('text-muted-foreground');
  });
});
