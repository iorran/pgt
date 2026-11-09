import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import { InfoTip } from '@/components/info-tip';
import { StudentsList } from '@/pages/owner/components/students-list';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));

async function asRole(role: string) {
  const { useSession } = await import('@/lib/auth-client');
  vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'u1', role } } } as any);
}

describe('InfoTip', () => {
  beforeEach(() => asRole('owner'));

  it('opens on click with the text and a link to the owner guide section', async () => {
    renderWithProviders(<InfoTip label="O que é status?" text="Explica o status." section="Painel da Academia" />);
    const button = screen.getByRole('button', { name: 'O que é status?' });
    expect(screen.queryByText('Explica o status.')).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(await screen.findByText('Explica o status.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'infoTip.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda#${encodeURIComponent('Painel da Academia')}`,
    );
  });

  it('links students to the student guide', async () => {
    await asRole('student');
    renderWithProviders(<InfoTip label="Pontos" text="Explica pontos." section="Gamificação" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pontos' }));
    expect(await screen.findByRole('link', { name: 'infoTip.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda?guia=aluno#${encodeURIComponent('Gamificação')}`,
    );
  });

  it('opens from the keyboard', async () => {
    renderWithProviders(<InfoTip label="Tip" text="Texto." section="Painel da Academia" />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Tip' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Texto.')).toBeInTheDocument();
  });
});

describe('StudentsList', () => {
  beforeEach(() => asRole('owner'));

  it('explains the student status', async () => {
    renderWithProviders(<StudentsList students={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'infoTip.status.label' }));
    expect(await screen.findByText('infoTip.status.text')).toBeInTheDocument();
  });
});
