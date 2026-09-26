import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../render';
import StudentsPage from '@/pages/students';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const session = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const table = () => screen.getByRole('table');

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue(session);
    vi.mocked(api).mockResolvedValue([
      {
        id: 's2',
        name: 'Zé',
        belt: 'white',
        monthlyFee: '45.00',
        dueDay: 5,
        familyName: 'Família Silva',
        modalities: [
          { id: 'm1', name: 'Jiu-Jitsu' },
          { id: 'm2', name: 'MMA' },
        ],
      },
      { id: 's1', name: 'Ana', belt: 'blue', monthlyFee: null, dueDay: null, modalities: [{ id: 'm3', name: 'Kids' }] },
    ] as any);
  });

  it('shows the monthly fee, modalities, translated belt and sorts by name', async () => {
    renderWithProviders(<StudentsPage />);
    await screen.findByRole('table');
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Ana');
    expect(rows[0]).toHaveTextContent('Kids');
    expect(rows[1]).toHaveTextContent('Zé');
    expect(rows[1]).toHaveTextContent(/45,00\s€/);
    expect(rows[1]).toHaveTextContent('Jiu-Jitsu');
    expect(rows[1]).toHaveTextContent('MMA');
    expect(rows[1]).toHaveTextContent('belts.white');
    const list = screen.getByRole('list', { name: 'nav.students' });
    expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('MMA');
  });

  it('filters by modality', async () => {
    renderWithProviders(<StudentsPage />);
    await screen.findByRole('table');
    const filter = screen.getByRole('group', { name: 'students.training.modalities' });
    const all = within(filter).getByRole('button', { name: 'students.training.allModalities' });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    const mma = within(filter).getByRole('button', { name: 'MMA' });
    fireEvent.click(mma);
    expect(mma).toHaveAttribute('aria-pressed', 'true');
    let rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Zé');
    // the count reflects the filter, not the whole academy
    expect(screen.getByText('students.countFiltered')).toBeInTheDocument();
    fireEvent.click(within(filter).getByRole('button', { name: 'Kids' }));
    rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Ana');
    fireEvent.click(all);
    expect(within(table()).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('students.count')).toBeInTheDocument();
  });

  it('renders an h1, a count and a labelled search box', async () => {
    renderWithProviders(<StudentsPage />);
    await screen.findByRole('table');
    expect(screen.getByRole('heading', { level: 1, name: 'nav.students' })).toBeInTheDocument();
    expect(screen.getByText('students.count')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'common.search' })).toBeInTheDocument();
  });

  it('renders a card list alongside the table for mobile', async () => {
    renderWithProviders(<StudentsPage />);
    const list = await screen.findByRole('list', { name: 'nav.students' });
    expect(within(list).getAllByRole('link')[0]).toHaveTextContent('Ana');
  });

  it('shows 50 students then more on demand', async () => {
    vi.mocked(api).mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, name: `Aluno ${String(i).padStart(2, '0')}`, belt: 'white' })) as any,
    );
    renderWithProviders(<StudentsPage />);
    await screen.findByRole('table');
    expect(within(table()).getAllByRole('row')).toHaveLength(51);
    fireEvent.click(screen.getByRole('button', { name: 'students.showMore' }));
    expect(within(table()).getAllByRole('row')).toHaveLength(61);
    expect(screen.queryByRole('button', { name: 'students.showMore' })).toBeNull();
  });

  it('shows the family name next to students that have one and links the Famílias tab', async () => {
    renderWithProviders(<StudentsPage />);
    await screen.findByRole('table');
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows[1]).toHaveTextContent('Família Silva');
    expect(rows[0]).not.toHaveTextContent('Família');
    expect(screen.getByRole('link', { name: 'families.title' })).toHaveAttribute('href', '/students/families');
  });
});
