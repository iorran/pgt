import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ProfilesPage from '@/pages/profiles';
import { getActingAs, wasProfileChosen, clearProfile } from '@/lib/profile';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
import { api } from '@/lib/api';

const assign = vi.fn();

describe('ProfilesPage — Quem vai usar?', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProfile();
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockProfiles(self: object | null) {
    vi.mocked(api).mockResolvedValue({
      actorId: 'r1',
      currentId: 'r1',
      self,
      dependents: [
        { id: 'd1', name: 'Livia Costa', belt: 'yellow', image: null },
        { id: 'd2', name: 'Miguel Costa', belt: 'white', image: null },
      ],
    } as any);
  }

  it('lists the Responsible (when they train) and every Dependent', async () => {
    mockProfiles({ id: 'r1', name: 'Rafael Costa', belt: 'purple', image: null });
    renderWithProviders(<ProfilesPage />);
    expect(await screen.findByRole('button', { name: /Rafael Costa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Livia Costa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Miguel Costa/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'profiles.title' })).toBeInTheDocument();
  });

  it('choosing a Dependent acts as them and reloads home', async () => {
    mockProfiles({ id: 'r1', name: 'Rafael Costa', belt: 'purple', image: null });
    renderWithProviders(<ProfilesPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Livia Costa/ }));
    expect(getActingAs()).toEqual({ id: 'd1', name: 'Livia Costa', belt: 'yellow', image: null });
    expect(wasProfileChosen()).toBe(true);
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('choosing yourself stops acting', async () => {
    mockProfiles({ id: 'r1', name: 'Rafael Costa', belt: 'purple', image: null });
    renderWithProviders(<ProfilesPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Rafael Costa/ }));
    expect(getActingAs()).toBeNull();
    expect(wasProfileChosen()).toBe(true);
  });

  it('offers a way back when switching profiles from inside the app', async () => {
    mockProfiles({ id: 'r1', name: 'Rafael Costa', belt: 'purple', image: null });
    renderWithProviders(<ProfilesPage canGoBack />);
    await screen.findByRole('button', { name: /Livia Costa/ });
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/');
  });

  it('has no way back when picking a profile is required', async () => {
    mockProfiles({ id: 'r1', name: 'Rafael Costa', belt: 'purple', image: null });
    renderWithProviders(<ProfilesPage />);
    await screen.findByRole('button', { name: /Livia Costa/ });
    expect(screen.queryByRole('link', { name: 'common.back' })).toBeNull();
  });

  it('a Responsible who does not train only sees Dependents', async () => {
    mockProfiles(null);
    renderWithProviders(<ProfilesPage />);
    await screen.findByRole('button', { name: /Livia Costa/ });
    expect(screen.getAllByRole('button')).toHaveLength(2 + 1); // two profiles + sign out
  });
});
