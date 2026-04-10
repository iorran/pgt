import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRoute } from '../../render';
import { StudentBottomNav } from '@/components/layout/student-bottom-nav';

describe('StudentBottomNav', () => {
  it('renders the five nav slots in order', () => {
    renderWithRoute(<StudentBottomNav />, ['/classes']);

    expect(screen.getByRole('link', { name: 'nav.classes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.checkin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.shop' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nav.me' })).toBeInTheDocument();
  });

  it('marks the active tab based on the current route', () => {
    renderWithRoute(<StudentBottomNav />, ['/marketplace']);
    const shopLink = screen.getByRole('link', { name: 'nav.shop' });
    expect(shopLink.getAttribute('aria-current')).toBe('page');
  });

  it('renders the FAB with an accessible label for check-in', () => {
    renderWithRoute(<StudentBottomNav />, ['/']);
    const fab = screen.getByRole('link', { name: 'nav.checkin' });
    expect(fab.getAttribute('href')).toBe('/checkin');
  });
});
