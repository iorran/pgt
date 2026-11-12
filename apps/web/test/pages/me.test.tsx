import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import MePage from '@/pages/me';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession, signOut } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockApi = vi.mocked(api);

const mockedUseSession = vi.mocked(useSession);
const mockedSignOut = vi.mocked(signOut);

describe('MePage', () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: {
        user: { id: 'u1', name: 'Aluno Teste', role: 'student', belt: 'blue' },
      },
      isPending: false,
    } as any);
    mockedSignOut.mockReset();
    mockApi.mockReset();
    mockApi.mockResolvedValue([] as any);
  });

  it('renders all hub rows', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('me.billingStatus')).toBeInTheDocument();
    expect(screen.getByText('me.tournaments')).toBeInTheDocument();
    expect(screen.getByText('me.language')).toBeInTheDocument();
    expect(screen.queryByText('me.theme')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'me.signOut' })).toBeInTheDocument();
  });

  it('hides Configurações from students, whose settings page is empty', () => {
    renderWithProviders(<MePage />);
    expect(screen.queryByText('me.settings')).not.toBeInTheDocument();
  });

  it('shows Configurações to the owner', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: 'o1', name: 'Dono', role: 'owner', belt: 'black' } },
      isPending: false,
    } as any);
    renderWithProviders(<MePage />);
    expect(screen.getByText('me.settings')).toBeInTheDocument();
  });

  it('calls signOut when the sign out button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MePage />);
    await user.click(screen.getByRole('button', { name: 'me.signOut' }));
    expect(mockedSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders the user name in the profile header', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Aluno Teste' })).toBeInTheDocument();
  });

  it('renders the belt translated, not the raw enum', () => {
    renderWithProviders(<MePage />);
    expect(screen.getByText('belts.blue')).toBeInTheDocument();
  });

  it('shows no agreement card to a Student who teaches no agreement', async () => {
    renderWithProviders(<MePage />);
    await vi.waitFor(() => expect(mockApi).toHaveBeenCalledWith(expect.stringMatching(/^\/me\/agreements\?month=\d{4}-\d{2}$/)));
    expect(screen.queryByText('teacherAgreement.title')).not.toBeInTheDocument();
  });

  it('links a teacher on an agreement to it', async () => {
    mockApi.mockResolvedValue([
      {
        agreement: { id: 'a1', name: 'No Gi', teachers: [{ id: 'u1', name: 'Aluno Teste' }] },
        month: '2026-11',
        confirmed: null,
        students: [{ studentId: 's1', name: 'Marta', kind: 'addOn', checkins: 2, paid: true }],
      },
    ] as any);
    renderWithProviders(<MePage />);
    const card = await screen.findByRole('link', { name: /teacherAgreement.title/ });
    expect(card).toHaveAttribute('href', '/me/agreement/a1');
    expect(card).toHaveTextContent('teacherAgreement.summaryPending');
  });
});
