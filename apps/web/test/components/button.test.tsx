import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('stays focusable but inert while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is natively disabled when disabled without loading', () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});
