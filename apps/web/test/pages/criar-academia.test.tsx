import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import CriarAcademiaPage from '@/pages/criar-academia';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

describe('CriarAcademiaPage', () => {
  it('renders user fields (name, email, password)', () => {
    renderWithProviders(<CriarAcademiaPage />);
    expect(screen.getByLabelText('auth.name')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
  });

  it('renders academy fields (name, city)', () => {
    renderWithProviders(<CriarAcademiaPage />);
    expect(screen.getByLabelText('onboarding.academyName')).toBeInTheDocument();
    expect(screen.getByLabelText('onboarding.city')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderWithProviders(<CriarAcademiaPage />);
    expect(screen.getByRole('button', { name: 'onboarding.createAcademy' })).toBeInTheDocument();
  });

  it('shows PGT branding', () => {
    renderWithProviders(<CriarAcademiaPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
    expect(screen.getByText('app.tagline')).toBeInTheDocument();
  });
});
