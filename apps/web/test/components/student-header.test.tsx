import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import { StudentHeader } from '@/components/layout/student-header';
import { clearProfile, markProfileChosen } from '@/lib/profile';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
import { useSession } from '@/lib/auth-client';

function session(user: object) {
  vi.mocked(useSession).mockReturnValue({ data: { user }, isPending: false } as any);
}

describe('StudentHeader', () => {
  beforeEach(() => clearProfile());

  it('shows the current profile name and "Trocar perfil" for a Family', () => {
    markProfileChosen();
    session({ id: 'd1', name: 'Livia Costa', actorId: 'r1' });
    renderWithProviders(<StudentHeader />);
    expect(screen.getByText('Livia Costa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'profiles.switch' })).toHaveAttribute('href', '/perfis');
  });

  it('no switch link for a student without a Family', () => {
    session({ id: 'u1', name: 'Solo', actorId: 'u1' });
    renderWithProviders(<StudentHeader />);
    expect(screen.queryByRole('link', { name: 'profiles.switch' })).toBeNull();
  });
});
