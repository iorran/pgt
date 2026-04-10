import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './render';
import App from '@/App';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/components/layout/student-shell', () => ({
  StudentShell: () => <div data-testid="student-shell" />,
}));
vi.mock('@/components/layout/staff-shell', () => ({
  StaffShell: () => <div data-testid="staff-shell" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

function setSession(role: 'student' | 'instructor') {
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
});
