import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../render';
import { ClassCreateDialog } from '@/components/schedule/class-create-dialog';

describe('ClassCreateDialog — a11y', () => {
  it('associates labels and toggles weekdays with aria-pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClassCreateDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(await screen.findByLabelText('classes.className')).toBeInTheDocument();
    expect(screen.getByLabelText('classes.classType')).toBeInTheDocument();
    expect(screen.getByLabelText('classes.startTime')).toBeInTheDocument();
    expect(screen.getByLabelText('classes.endTime')).toBeInTheDocument();
    const mon = screen.getByRole('button', { name: 'classes.days.mon' });
    expect(mon).toHaveAttribute('aria-pressed', 'false');
    await user.click(mon);
    expect(mon).toHaveAttribute('aria-pressed', 'true');
  });
});
