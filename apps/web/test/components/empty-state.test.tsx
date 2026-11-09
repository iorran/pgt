import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { renderWithProviders } from '../render';
import { EmptyState } from '@/components/empty-state';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));

import { useSession } from '@/lib/auth-client';

function as(role: string) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'u1', role } } } as any);
}

describe('EmptyState', () => {
  beforeEach(() => {
    as('owner');
  });

  it('renders title, explanation, action and the "learn more" link', () => {
    renderWithProviders(
      <EmptyState
        icon={Users}
        title="Nenhuma família"
        description="Agrupe irmãos para cobrar uma mensalidade só."
        action={<button>Cadastrar família</button>}
        help="Criar uma Família"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nenhuma família' })).toBeInTheDocument();
    expect(screen.getByText('Agrupe irmãos para cobrar uma mensalidade só.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar família' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'emptyState.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda#${encodeURIComponent('Criar uma Família')}`,
    );
  });

  it('hides the owner-guide link from non-owners', () => {
    as('student');
    renderWithProviders(<EmptyState title="t" description="d" help="Financeiro" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links students to their own guide section', () => {
    as('student');
    renderWithProviders(<EmptyState title="t" description="d" help="Loja" studentHelp="Explorar Produtos" />);
    expect(screen.getByRole('link', { name: 'emptyState.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda#${encodeURIComponent('Explorar Produtos')}`,
    );
  });

  it('links the owner to the student guide when only a student section exists', () => {
    renderWithProviders(<EmptyState title="t" description="d" studentHelp="Pagamentos" />);
    expect(screen.getByRole('link', { name: 'emptyState.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda?guia=aluno#Pagamentos`,
    );
  });
});
