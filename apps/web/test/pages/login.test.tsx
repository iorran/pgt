import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders } from '../render';
import LoginPage from '../../src/pages/login';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
  signIn: {
    email: vi.fn(),
  },
  signOut: vi.fn(),
}));

import { signIn } from '@/lib/auth-client';

const mockedSignInEmail = vi.mocked(signIn.email);

function renderAt(url: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/checkin" element={<div data-testid="checkin">checkin</div>} />
          <Route path="/" element={<div data-testid="home">home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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

  it('renders the forgot password link', () => {
    renderWithProviders(<LoginPage />);
    const link = screen.getByText('auth.forgotPassword');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
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

  it('navigates to redirect param when it is a safe relative path', async () => {
    mockedSignInEmail.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login?redirect=%2Fcheckin%3Ftoken%3Dabc%26classId%3Dc1');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('checkin')).toBeInTheDocument());
  });

  it('falls back to / when redirect param is missing', async () => {
    mockedSignInEmail.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  it('ignores redirect when it is protocol-relative (open-redirect guard)', async () => {
    mockedSignInEmail.mockResolvedValue({ error: null } as any);
    const user = userEvent.setup();
    renderAt('/login?redirect=%2F%2Fevil.example.com');

    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'auth.login' }));

    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });
});
