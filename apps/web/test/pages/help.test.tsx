import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithRoute } from '../render';
import HelpPage from '@/pages/help';
import { HelpLink } from '@/components/help-link';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
import { useSession } from '@/lib/auth-client';

function as(role: string) {
  vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'u1', role } }, isPending: false } as any);
}

function section(name: string) {
  return screen.getByText(name, { selector: 'summary *' }).closest('details')!;
}

describe('HelpPage', () => {
  it('shows the student guide to a student, every section closed', () => {
    as('student');
    renderWithRoute(<HelpPage />, ['/ajuda']);
    expect(section('Conta da Família')).not.toHaveAttribute('open');
    expect(screen.queryByText('Gerenciando Alunos')).toBeNull();
    expect(screen.queryByRole('link', { name: 'help.ownerGuide' })).toBeNull();
  });

  it('has a back link home', () => {
    as('student');
    renderWithRoute(<HelpPage />, ['/ajuda']);
    expect(screen.getByRole('heading', { level: 1, name: 'help.title' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/');
  });

  it('shows the owner guide to the owner, with a switch to the student guide', () => {
    as('owner');
    renderWithRoute(<HelpPage />, ['/ajuda']);
    expect(section('Gerenciando Alunos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'help.studentGuide' })).toHaveAttribute('href', '/ajuda?guia=aluno');
  });

  it('opens the section named in the link hash', () => {
    as('owner');
    renderWithRoute(<HelpPage />, ['/ajuda#Famílias']);
    expect(section('Famílias')).toHaveAttribute('open');
    expect(within(section('Famílias')).getByRole('heading', { name: 'Responsável da Família' })).toBeInTheDocument();
  });

  it('search keeps only matching sections, opened', async () => {
    as('student');
    renderWithRoute(<HelpPage />, ['/ajuda']);
    await userEvent.type(screen.getByRole('searchbox'), 'trocar perfil');
    expect(section('Conta da Família')).toHaveAttribute('open');
    expect(screen.queryByText('Loja', { selector: 'summary *' })).toBeNull();
  });

  it('says so when nothing matches', async () => {
    as('student');
    renderWithRoute(<HelpPage />, ['/ajuda']);
    await userEvent.type(screen.getByRole('searchbox'), 'xyzzy');
    expect(screen.getByText('help.noResults')).toBeInTheDocument();
  });

  it('renders the guide screenshots', () => {
    as('student');
    renderWithRoute(<HelpPage />, ['/ajuda#Conta da Família']);
    const img = within(section('Conta da Família')).getByRole('img', { name: 'Quem vai usar?' });
    expect(img.getAttribute('src')).toMatch(/profile-picker/);
  });
});

describe('HelpLink', () => {
  it('points at the section for the current screen', () => {
    renderWithRoute(
      <Routes>
        <Route path="*" element={<HelpLink guide="owner" />} />
      </Routes>,
      ['/students/families'],
    );
    expect(screen.getByRole('link', { name: 'help.title' })).toHaveAttribute('href', '/ajuda#Fam%C3%ADlias');
  });

  it('points at the guide top when the screen has no section', () => {
    renderWithRoute(<HelpLink guide="student" />, ['/perfis']);
    expect(screen.getByRole('link', { name: 'help.title' })).toHaveAttribute('href', '/ajuda');
  });
});
