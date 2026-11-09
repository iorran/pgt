import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithRoute } from '../render';

const sessionMock = vi.fn();
vi.mock('@/lib/auth-client', () => ({ useSession: () => sessionMock(), signOut: vi.fn() }));

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { StaffBottomNav } from '@/components/layout/staff-bottom-nav';

const at = (path: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('staff navigation', () => {
  beforeEach(() => sessionMock.mockReturnValue({ data: { user: { name: 'Admin', role: 'owner' } } }));

  it('marks the section active on nested routes via aria-current', () => {
    at('/students/abc', <Sidebar />);
    expect(screen.getByRole('link', { name: 'nav.students' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks billing active on /billing/payments', () => {
    at('/billing/payments', <Sidebar />);
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

  it('header keeps language and logout for desktop only', () => {
    renderWithRoute(<Header />, ['/']);
    expect(screen.getByRole('group', { name: 'me.language' })).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('button', { name: 'auth.logout' })).toHaveClass('hidden', 'md:inline-flex');
    expect(screen.queryByRole('button', { name: 'nav.menu' })).toBeNull();
  });
});

describe('staff bottom nav (mobile)', () => {
  beforeEach(() => sessionMock.mockReturnValue({ data: { user: { name: 'Admin', role: 'owner' } } }));

  it('shows the four daily sections and hides on desktop', () => {
    at('/', <StaffBottomNav />);
    const nav = screen.getByRole('navigation', { name: 'nav.staffBottom' });
    expect(nav).toHaveClass('md:hidden');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'nav.classes' })).toHaveAttribute('href', '/classes');
    expect(screen.getByRole('link', { name: 'nav.students' })).toHaveAttribute('href', '/students');
    expect(screen.getByRole('link', { name: 'nav.billing' })).toHaveAttribute('href', '/billing');
  });

  it('marks the tab active on nested routes', () => {
    at('/classes/history', <StaffBottomNav />);
    expect(screen.getByRole('link', { name: 'nav.classes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'nav.dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('"More" opens the full menu with language and logout', async () => {
    at('/', <StaffBottomNav />);
    await userEvent.click(screen.getByRole('button', { name: 'nav.more' }));
    expect(await screen.findByRole('link', { name: 'nav.marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.totem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.logout' })).toBeInTheDocument();
  });
});
