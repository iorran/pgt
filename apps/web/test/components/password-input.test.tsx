import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/ui/password-input';

describe('PasswordInput', () => {
  it('toggles password visibility', async () => {
    render(<PasswordInput aria-label="Senha" defaultValue="segredo" />);
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'auth.showPassword' }));
    expect(input).toHaveAttribute('type', 'text');

    const hide = screen.getByRole('button', { name: 'auth.hidePassword' });
    await userEvent.click(hide);
    expect(input).toHaveAttribute('type', 'password');
  });
});
