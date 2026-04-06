import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import LoginPage from '@/pages/login';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
  signIn: {
    email: vi.fn(),
  },
  signOut: vi.fn(),
}));

import { signIn } from '@/lib/auth-client';

const mockedSignInEmail = vi.mocked(signIn.email);

describe('LoginPage', () => {
  beforeEach(() => {
    mockedSignInEmail.mockClear();
  });

  it('renders email and password inputs', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
  });

  it('renders login button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: 'auth.login' })).toBeInTheDocument();
  });

  it('renders signup link', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('auth.signup')).toBeInTheDocument();
  });

  it('shows PGT branding', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('app.tagline')).toBeInTheDocument();
  });

  it('shows error message when login fails', async () => {
    mockedSignInEmail.mockResolvedValue({
      error: { message: 'Invalid credentials' },
    } as any);

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('auth.email'), 'test@test.com');
    await user.type(screen.getByLabelText('auth.password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
