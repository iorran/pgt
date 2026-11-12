import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

// Picks an item in a SearchCombobox: type to filter, then tap the option.
export async function pickOption(user: UserEvent, label: string, query: string, option: string = query) {
  const input = await screen.findByRole('combobox', { name: label });
  await user.type(input, query);
  await user.click(await screen.findByRole('option', { name: new RegExp(option) }));
}
