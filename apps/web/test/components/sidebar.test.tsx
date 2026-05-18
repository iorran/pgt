import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '../render';

const sessionMock = vi.fn();
vi.mock('@/lib/auth-client', () => ({ useSession: () => sessionMock(), signOut: vi.fn() }));

import { Sidebar } from '@/components/layout/sidebar';

function renderSidebar() {
  return render(<MemoryRouter><Sidebar /></MemoryRouter>);
}

describe('Sidebar role gating', () => {
  beforeEach(() => sessionMock.mockReset());

  it('shows students/billing/settings for owner', () => {
    sessionMock.mockReturnValue({ data: { user: { role: 'owner' } } });
    renderSidebar();
    expect(screen.getByText('nav.students')).toBeInTheDocument();
    expect(screen.getByText('nav.billing')).toBeInTheDocument();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('hides them for student', () => {
    sessionMock.mockReturnValue({ data: { user: { role: 'student' } } });
    renderSidebar();
    expect(screen.queryByText('nav.students')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.billing')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.settings')).not.toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({
      data: { user: { name: 'Test User', role: 'owner' } },
      isPending: false,
    });
  });

  it('renders PGT branding', () => {
    renderSidebar();
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('app.tagline')).toBeInTheDocument();
  });

  it('shows all nav items for owner', () => {
    renderSidebar();
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.classes')).toBeInTheDocument();
    expect(screen.getByText('nav.students')).toBeInTheDocument();
    expect(screen.queryByText('onboarding.pendingStudents')).not.toBeInTheDocument();
    expect(screen.getByText('nav.billing')).toBeInTheDocument();
    expect(screen.getByText('nav.marketplace')).toBeInTheDocument();
    expect(screen.getByText('nav.gamification')).toBeInTheDocument();
    expect(screen.getByText('nav.tournaments')).toBeInTheDocument();
  });

  it('hides owner-only items for students', () => {
    sessionMock.mockReturnValue({
      data: { user: { name: 'Student', role: 'student' } },
      isPending: false,
    });

    renderSidebar();
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
    renderSidebar();
    const dashboardLink = screen.getByText('nav.dashboard');
    expect(dashboardLink.className).toContain('text-primary');
    expect(dashboardLink.className).toContain('border-primary');

    const classesLink = screen.getByText('nav.classes');
    expect(classesLink.className).toContain('text-muted-foreground');
  });
});
