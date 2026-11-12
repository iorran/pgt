import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchCombobox, type SearchItem } from '@/components/search-combobox';

const people: SearchItem[] = [
  { id: 'a', name: 'Ana Souza', belt: 'blue' },
  { id: 'b', name: 'Bia Lima', belt: 'black' },
  { id: 'c', name: 'Carlos Dias' },
];

describe('SearchCombobox', () => {
  it('filters by typing and picks one item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchCombobox id="s" aria-label="Aluno" items={people} value={null} onChange={onChange} />);
    await user.type(screen.getByRole('combobox', { name: 'Aluno' }), 'bia');
    expect(await screen.findByRole('option', { name: /Bia Lima/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ana Souza/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Bia Lima/ }));
    expect(onChange).toHaveBeenCalledWith(people[1]);
  });

  it('picks several items as chips and removes one', async () => {
    const user = userEvent.setup();
    function Multi() {
      const [value, setValue] = useState<SearchItem[]>([people[0]]);
      return <SearchCombobox id="m" aria-label="Professores" multiple items={people} value={value} onChange={setValue} />;
    }
    render(<Multi />);
    const input = screen.getByRole('combobox', { name: 'Professores' });
    await user.type(input, 'car');
    await user.click(await screen.findByRole('option', { name: /Carlos Dias/ }));
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Carlos Dias')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });
});
