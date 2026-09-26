import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { signUp } from '@/lib/auth-client';

const mockedSignUp = vi.mocked(signUp.email);

describe('CriarAcademiaPage', () => {
  it('renders user fields (name, email, password)', () => {
    renderWithProviders(<CriarAcademiaPage />);
    expect(screen.getByLabelText('auth.name')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument();
  });

  it('requires 8+ char password with hint and autocomplete hints', () => {
    renderWithProviders(<CriarAcademiaPage />);
    const password = screen.getByLabelText('auth.password');
    expect(password).toHaveAttribute('minlength', '8');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAccessibleDescription('auth.passwordHint');
    expect(screen.getByLabelText('auth.email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('auth.email')).toHaveAttribute('inputmode', 'email');
    expect(screen.getByLabelText('auth.name')).toHaveAttribute('autocomplete', 'name');
  });

  it('shows a translated alert when signup fails', async () => {
    mockedSignUp.mockResolvedValue({ error: { message: 'User already exists' } } as any);
    const user = userEvent.setup();
    renderWithProviders(<CriarAcademiaPage />);

    await user.type(screen.getByLabelText('auth.name'), 'Ana');
    await user.type(screen.getByLabelText('auth.email'), 'a@b.com');
    await user.type(screen.getByLabelText('auth.password'), 'secret123');
    await user.type(screen.getByLabelText('onboarding.academyName'), 'PGT');
    await user.type(screen.getByLabelText('onboarding.city'), 'Rio');
    await user.click(screen.getByRole('button', { name: 'onboarding.createAcademy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('common.genericError');
    expect(screen.queryByText('User already exists')).not.toBeInTheDocument();
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
