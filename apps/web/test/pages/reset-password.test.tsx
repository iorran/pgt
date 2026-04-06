import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ResetPasswordPage from '../../src/pages/reset-password';
import { resetPassword } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({
  resetPassword: vi.fn(),
}));

// Mock useSearchParams to provide a token
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('token=test-token-123')],
  };
});

const mockedResetPassword = vi.mocked(resetPassword);

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResetPassword.mockResolvedValue({} as any);
  });

  it('renders the password form', () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByLabelText('auth.newPassword')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.confirmPassword')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' })).toBeInTheDocument();
  });

  it('renders the PGT branding', () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'password123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'different456');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    expect(screen.getByText('auth.resetPasswordMismatch')).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword with token and new password on valid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith({
        newPassword: 'newpass123',
        token: 'test-token-123',
      });
    });
  });

  it('shows success message after successful reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.resetPasswordSuccess')).toBeInTheDocument();
    });
  });

  it('shows error message when reset fails (invalid/expired token)', async () => {
    mockedResetPassword.mockRejectedValue(new Error('Invalid token'));
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.resetPasswordError')).toBeInTheDocument();
    });
    expect(screen.getByText('auth.requestNewReset')).toBeInTheDocument();
  });
});
