import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import SignupPage from '@/pages/signup';

describe('SignupPage', () => {
  it('renders two cards: create academy and have code', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByText('onboarding.createAcademyDesc')).toBeInTheDocument();
    expect(screen.getByText('onboarding.haveCodeDesc')).toBeInTheDocument();
  });

  it('shows code input field', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByPlaceholderText('onboarding.enterCode')).toBeInTheDocument();
  });

  it('continue button is disabled when code is empty', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole('button', { name: 'onboarding.continue' })).toBeDisabled();
  });

  it('continue button is enabled when code has value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByPlaceholderText('onboarding.enterCode'), 'ABC123');
    expect(screen.getByRole('button', { name: 'onboarding.continue' })).toBeEnabled();
  });

  it('renders login link', () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByText('auth.login')).toBeInTheDocument();
  });
});
