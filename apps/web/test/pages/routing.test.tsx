import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRoute } from '../render';
import App from '../../src/App';

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signOut: vi.fn(),
  signIn: { email: vi.fn() },
  forgetPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

describe('Unauthenticated routing', () => {
  it('renders forgot-password page at /forgot-password', async () => {
    renderWithRoute(<App />, ['/forgot-password']);
    expect(await screen.findByText('auth.forgotPasswordTitle')).toBeInTheDocument();
  });

  it('renders reset-password page at /reset-password', async () => {
    renderWithRoute(<App />, ['/reset-password?token=abc']);
    expect(await screen.findByText('auth.resetPasswordTitle')).toBeInTheDocument();
  });
});
