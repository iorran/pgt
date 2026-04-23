import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../render';
import { ClassEditDialog } from '@/components/schedule/class-edit-dialog';
import type { ClassItem } from '@/lib/schedule';

const cls: ClassItem = {
  id: 'c1',
  name: 'Morning Gi',
  type: 'gi',
  dayOfWeek: 2,
  startTime: '07:00',
  endTime: '08:30',
};

describe('ClassEditDialog — race guards', () => {
  it('disables Delete while the form is submitting', async () => {
    const user = userEvent.setup();
    let releaseSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () => new Promise<void>((resolve) => (releaseSubmit = resolve)),
    );

    renderWithProviders(
      <ClassEditDialog
        cls={cls}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onDelete={vi.fn()}
      />,
    );

    const saveBtn = await screen.findByRole('button', { name: 'common.save' });
    const deleteBtn = screen.getByRole('button', { name: 'classes.deleteClass' });

    expect(deleteBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => expect(deleteBtn).toBeDisabled());

    releaseSubmit?.();
    await waitFor(() => expect(deleteBtn).not.toBeDisabled());
  });

  it('disables Save while the confirm-delete panel is open', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ClassEditDialog
        cls={cls}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const saveBtn = await screen.findByRole('button', { name: 'common.save' });
    expect(saveBtn).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'classes.deleteClass' }));

    await waitFor(() => expect(saveBtn).toBeDisabled());

    // Cancel the delete confirmation — Save re-enables.
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });
});
