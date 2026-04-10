import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../render';
import { StudentHeader } from '@/components/layout/student-header';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);

describe('StudentHeader', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { name: 'Aluno Teste', role: 'student' },
      },
      isPending: false,
    } as any);
  });

  it('renders the PGT wordmark', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('renders the authenticated user name', () => {
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('Aluno Teste')).toBeInTheDocument();
  });

  it('omits the user name when the session has none', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { role: 'student' } },
      isPending: false,
    } as any);
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });
});
