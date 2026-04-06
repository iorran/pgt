import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ForgotPasswordPage from '../../src/pages/forgot-password';
import { forgetPassword } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({
  forgetPassword: vi.fn(),
}));

const mockedForgetPassword = vi.mocked(forgetPassword);

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedForgetPassword.mockResolvedValue({} as any);
  });

  it('renders the email form', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' })).toBeInTheDocument();
  });

  it('renders the PGT branding', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('renders a back to login link', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByText('auth.backToLogin')).toBeInTheDocument();
  });

  it('calls forgetPassword on submit and shows success message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('auth.email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' }));

    await waitFor(() => {
      expect(mockedForgetPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        redirectTo: expect.stringContaining('/reset-password'),
      });
    });

    expect(screen.getByText('auth.forgotPasswordSuccess')).toBeInTheDocument();
  });

  it('shows success message even if forgetPassword fails (no email enumeration)', async () => {
    mockedForgetPassword.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('auth.email'), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.forgotPasswordSuccess')).toBeInTheDocument();
    });
  });
});
