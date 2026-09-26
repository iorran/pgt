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

  it.each([
    ['/gamification', 'nav.progress'],
    ['/gamification/seasons', 'nav.progress'],
    ['/gamification/profile', 'nav.progress'],
    ['/me', 'nav.me'],
    ['/me/billing', 'nav.me'],
    ['/tournaments', 'nav.me'],
  ])('marks the right tab active on %s', (path, label) => {
    renderWithRoute(<StudentBottomNav />, [path]);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    const others = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');
    expect(others).toHaveLength(1);
  });

  it('renders the FAB with an accessible label for check-in', () => {
    renderWithRoute(<StudentBottomNav />, ['/']);
    const fab = screen.getByRole('link', { name: 'nav.checkin' });
    expect(fab.getAttribute('href')).toBe('/checkin');
  });
});
