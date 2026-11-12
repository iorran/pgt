import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import FamiliesPage from '@/pages/students/families';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const session = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const silva = {
  id: 'f1',
  name: 'Família Silva',
  responsible: { id: 's1', name: 'Bia', email: 'bia@x.com', phone: null, trains: true },
  agreedPrice: '100.00',
  priceReviewNeeded: true,
  familyFee: '100.00',
  members: [
    { id: 's1', name: 'Bia', phone: null, belt: 'white', monthlyFee: '35.00' },
    { id: 's2', name: 'Leo', phone: null, belt: 'white', monthlyFee: '35.00' },
  ],
};

const students = [
  { id: 's1', name: 'Bia', belt: 'white', familyId: 'f1' },
  { id: 's2', name: 'Leo', belt: 'white', familyId: 'f1' },
  { id: 's3', name: 'Carlos', belt: 'blue', familyId: null },
  { id: 's4', name: 'Duda', belt: 'white', familyId: null },
];

let suggestions: any[];

describe('FamiliesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue(session);
    suggestions = [{ phone: '934232146', students: [{ id: 's3', name: 'Carlos' }, { id: 's4', name: 'Duda' }] }];
    vi.mocked(api).mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method) {
        return {};
      }
      if (path === '/families') {
        return [silva];
      }
      if (path === '/families/suggestions') {
        return suggestions;
      }
      if (path.startsWith('/students')) {
        return students;
      }
      return [];
    });
  });

  it('renders the Famílias tab, h1 and the family list with fee, agreed badge and review warning', async () => {
    renderWithProviders(<FamiliesPage />);
    const card = (await screen.findByRole('heading', { name: 'Família Silva' })).closest('li')!;
    expect(screen.getByRole('heading', { level: 1, name: 'nav.students' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'families.title' })).toHaveAttribute('href', '/students/families');
    expect(within(card).getByText('Bia e Leo')).toBeInTheDocument();
    expect(within(card).getByText(/100,00\s€/)).toBeInTheDocument();
    expect(within(card).getByText('families.agreedPrice')).toBeInTheDocument();
    expect(within(card).getByText('families.priceReviewNeeded')).toBeInTheDocument();
  });

  it('creates a family with members that have no family yet', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'families.new' }));
    await user.type(screen.getByLabelText('families.name'), 'Família Stefan');
    await user.type(screen.getByLabelText('families.searchMembers'), 'a');
    // Bia is already in a family: not offered.
    expect(await screen.findByRole('option', { name: /Carlos/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Bia/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: /Carlos/ }));
    expect(screen.getByLabelText('families.searchMembers')).toHaveValue('');
    await user.selectOptions(screen.getByLabelText('families.responsible'), 's3');
    await user.type(screen.getByLabelText('families.familyAgreedPrice'), '80');
    await user.click(screen.getByRole('button', { name: 'common.create' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families', {
        method: 'POST',
        body: JSON.stringify({ name: 'Família Stefan', memberIds: ['s3'], responsibleId: 's3', agreedPrice: '80' }),
      }),
    );
  });

  it('requires at least one member before creating', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'families.new' }));
    await user.type(screen.getByLabelText('families.name'), 'X');
    expect(screen.getByRole('button', { name: 'common.create' })).toBeDisabled();
  });

  it('shows a translated error when a student already belongs to a family', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        throw new Error('STUDENT_IN_FAMILY');
      }
      if (path === '/families') {
        return [];
      }
      if (path.startsWith('/students')) {
        return students;
      }
      return [];
    });
    renderWithProviders(<FamiliesPage />);
    // No families yet: the create dialog opens from the empty state.
    await user.click(await screen.findByRole('button', { name: 'emptyState.families.action' }));
    await user.type(screen.getByLabelText('families.name'), 'X');
    await user.type(screen.getByLabelText('families.searchMembers'), 'Car');
    await user.click(await screen.findByRole('option', { name: /Carlos/ }));
    await user.selectOptions(screen.getByLabelText('families.responsible'), 's3');
    await user.click(screen.getByRole('button', { name: 'common.create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('families.errors.studentInFamily');
  });

  it('edits name and agreed price, adds and removes members', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    await user.click(screen.getByRole('button', { name: 'families.removeMember Leo' }));
    await user.click(screen.getByRole('button', { name: 'families.confirmRemove' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1/members/s2', { method: 'DELETE', body: JSON.stringify({}) }),
    );

    await user.type(screen.getByLabelText('families.searchMembers'), 'Du');
    await user.click(await screen.findByRole('option', { name: /Duda/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1/members', {
        method: 'POST',
        body: JSON.stringify({ studentId: 's4' }),
      }),
    );

    const name = screen.getByLabelText('families.name');
    await user.clear(name);
    await user.type(name, 'Silva');
    const price = screen.getByLabelText('families.familyAgreedPrice');
    await user.clear(price);
    await user.type(price, '90');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Silva', agreedPrice: '90' }),
      }),
    );
  });

  it('deletes a family after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    await user.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(api).not.toHaveBeenCalledWith('/families/f1', { method: 'DELETE' });
    expect(screen.getByText('families.deleteConfirm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'families.deleteTitle' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/families/f1', { method: 'DELETE' }));
  });

  it('lists possible families: create pre-fills members, dismiss posts the phone', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    const section = (await screen.findByRole('heading', { name: 'families.suggestions' })).closest('section')!;
    expect(within(section).getByText('Carlos e Duda')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'families.dismiss' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/suggestions/dismiss', {
        method: 'POST',
        body: JSON.stringify({ phone: '934232146' }),
      }),
    );

    await user.click(within(section).getByRole('button', { name: 'families.createFamily' }));
    expect(screen.getByLabelText('families.name')).toHaveValue('');
    const members = screen.getByRole('list', { name: 'families.members' });
    expect(within(members).getByText('Carlos')).toBeInTheDocument();
    expect(within(members).getByText('Duda')).toBeInTheDocument();
  });

  it('hides possible families when there are none', async () => {
    suggestions = [];
    renderWithProviders(<FamiliesPage />);
    await screen.findByRole('heading', { name: 'Família Silva' });
    expect(screen.queryByRole('heading', { name: 'families.suggestions' })).toBeNull();
  });
  it('shows the Responsible on the family card', async () => {
    renderWithProviders(<FamiliesPage />);
    const card = (await screen.findByRole('heading', { name: 'Família Silva' })).closest('li')!;
    expect(within(card).getByText(/families\.responsible: Bia/)).toBeInTheDocument();
  });

  it('creates a family with a new Responsible who does not train', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'families.new' }));
    await user.type(screen.getByLabelText('families.name'), 'Lima');
    await user.type(screen.getByLabelText('families.searchMembers'), 'Car');
    await user.click(await screen.findByRole('option', { name: /Carlos/ }));
    await user.selectOptions(screen.getByLabelText('families.responsible'), '__new');
    await user.type(screen.getByLabelText('families.responsibleName'), 'Paula');
    await user.type(screen.getByLabelText('families.responsibleEmail'), 'paula@x.com');
    await user.click(screen.getByRole('button', { name: 'common.create' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families', {
        method: 'POST',
        body: JSON.stringify({ name: 'Lima', memberIds: ['s3'], responsible: { name: 'Paula', email: 'paula@x.com' } }),
      }),
    );
  });

  it('requires a Responsible before creating', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'families.new' }));
    await user.type(screen.getByLabelText('families.name'), 'X');
    await user.type(screen.getByLabelText('families.searchMembers'), 'Car');
    await user.click(await screen.findByRole('option', { name: /Carlos/ }));
    expect(screen.getByRole('button', { name: 'common.create' })).toBeDisabled();
  });

  it('changes the Responsible (warning: the old one loses their own login) and saves', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    await user.selectOptions(screen.getByLabelText('families.responsible'), 's2');
    expect(screen.getByText('families.loginMoves')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1/responsible', { method: 'PUT', body: JSON.stringify({ userId: 's2' }) }),
    );
  });

  it('sends an invite to the Responsible', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    await user.click(screen.getByRole('button', { name: 'families.sendInvite' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/families/f1/responsible/invite', { method: 'POST' }));
  });

  it('removes a member with their own email so they can log in alone', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    await user.click(screen.getByRole('button', { name: 'families.removeMember Leo' }));
    await user.type(screen.getByLabelText('families.ownEmail'), 'leo@x.com');
    await user.click(screen.getByRole('button', { name: 'families.confirmRemove' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1/members/s2', { method: 'DELETE', body: JSON.stringify({ email: 'leo@x.com' }) }),
    );
  });

  it('the Responsible cannot be removed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FamiliesPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit Família Silva' }));
    expect(screen.getByRole('button', { name: 'families.removeMember Bia' })).toBeDisabled();
  });
  it('teaches what families are for when there are none, with a create action and guide link', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => (path === '/families' ? [] : []));
    renderWithProviders(<FamiliesPage />);
    expect(await screen.findByRole('heading', { name: 'families.empty' })).toBeInTheDocument();
    expect(screen.getByText('emptyState.families.description')).toBeInTheDocument();
    // Only the empty-state CTA: the header button would duplicate it.
    expect(screen.queryByRole('button', { name: 'families.new' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'emptyState.learnMore' })).toHaveAttribute(
      'href',
      `/ajuda#${encodeURIComponent('Criar uma Família')}`,
    );
    await user.click(screen.getByRole('button', { name: 'emptyState.families.action' }));
    expect(screen.getByLabelText('families.name')).toBeInTheDocument();
  });
});
