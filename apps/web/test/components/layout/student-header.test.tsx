import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../render';
import { StudentHeader } from '@/components/layout/student-header';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/components/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

describe('StudentHeader', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { name: 'Aluno', role: 'student', academyName: 'Academia Teste' },
      },
      isPending: false,
    } as any);
  });

  it('renders the PGT wordmark', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('renders the academy name from session', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('Academia Teste')).toBeInTheDocument();
  });

  it('renders the notification bell', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });
});
