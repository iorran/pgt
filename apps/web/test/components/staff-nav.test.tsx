import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithRoute } from '../render';

const sessionMock = vi.fn();
vi.mock('@/lib/auth-client', () => ({ useSession: () => sessionMock(), signOut: vi.fn() }));

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const at = (path: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('staff navigation', () => {
  beforeEach(() => sessionMock.mockReturnValue({ data: { user: { name: 'Admin', role: 'owner' } } }));

  it('marks the section active on nested routes via aria-current', () => {
    at('/students/abc', <Sidebar />);
    expect(screen.getByRole('link', { name: 'nav.students' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks billing active on /billing/plans', () => {
    at('/billing/plans', <Sidebar />);
    expect(screen.getByRole('link', { name: 'nav.billing' })).toHaveAttribute('aria-current', 'page');
  });

  it('links the owner to the totem', () => {
    at('/', <Sidebar />);
    expect(screen.getByRole('link', { name: 'nav.totem' })).toHaveAttribute('href', '/totem');
  });

  it('hides the sidebar below md', () => {
    at('/', <Sidebar />);
    expect(screen.getByRole('navigation')).toHaveClass('hidden', 'md:flex');
  });

  it('header menu button opens the nav on mobile', async () => {
    renderWithRoute(<Header />, ['/']);
    const menu = screen.getByRole('button', { name: 'nav.menu' });
    expect(menu).toHaveClass('md:hidden');
    await userEvent.click(menu);
    expect(await screen.findByRole('link', { name: 'nav.students' })).toBeInTheDocument();
  });
});
