import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import MePage from '@/pages/me';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession, signOut } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);
const mockedSignOut = vi.mocked(signOut);

describe('MePage', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Aluno Teste', role: 'student', belt: 'blue' },
      },
      isPending: false,
    } as any);
    mockedSignOut.mockReset();
  });

  it('renders all hub rows', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('me.billingStatus')).toBeInTheDocument();
    expect(screen.getByText('me.tournaments')).toBeInTheDocument();
    expect(screen.getByText('me.language')).toBeInTheDocument();
    expect(screen.getByText('me.theme')).toBeInTheDocument();
    expect(screen.getByText('me.settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'me.signOut' })).toBeInTheDocument();
  });

  it('calls signOut when the sign out button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MePage />);
    await user.click(screen.getByRole('button', { name: 'me.signOut' }));
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders the user name in the profile header', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('Aluno Teste')).toBeInTheDocument();
  });
});
