import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabsNav } from '@/components/tabs-nav';

describe('TabsNav', () => {
  it('renders the page title as h1 and marks the active tab', () => {
    render(<MemoryRouter initialEntries={['/b']}><TabsNav title="Financeiro" items={[{ to: '/a', label: 'A' }, { to: '/b', label: 'B' }]} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'B' })).toHaveAttribute('aria-current', 'page');
  });
});
