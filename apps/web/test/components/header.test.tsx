import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import { Header } from '@/components/layout/header';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession, signOut } from '@/lib/auth-client';

const mockedUseSession = vi.mocked(useSession);
const mockedSignOut = vi.mocked(signOut);

describe('Header', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: 'Iorran Castro' } },
      isPending: false,
    } as any);
    mockedSignOut.mockClear();
  });

  it('renders user name', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('Iorran Castro')).toBeInTheDocument();
  });

  it('renders language switcher', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('PT')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('auth.logout')).toBeInTheDocument();
  });

  it('calls signOut when logout clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />);
    await user.click(screen.getByText('auth.logout'));
    expect(mockedSignOut).toHaveBeenCalled();
  });
});
