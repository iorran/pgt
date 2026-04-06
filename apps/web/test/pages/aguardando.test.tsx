import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import AguardandoPage from '@/pages/aguardando';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
  signOut: vi.fn(),
}));

describe('AguardandoPage', () => {
  it('shows waiting title and message', () => {
    renderWithProviders(<AguardandoPage />);
    expect(screen.getByText('onboarding.waitingTitle')).toBeInTheDocument();
    expect(screen.getByText('onboarding.waitingMessage')).toBeInTheDocument();
  });

  it('shows refresh button', () => {
    renderWithProviders(<AguardandoPage />);
    expect(screen.getByText('onboarding.waitingRefresh')).toBeInTheDocument();
  });

  it('shows logout button', () => {
    renderWithProviders(<AguardandoPage />);
    expect(screen.getByText('auth.logout')).toBeInTheDocument();
  });
});
