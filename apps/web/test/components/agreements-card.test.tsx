import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import { AgreementsCard } from '@/components/agreements-card';

// Interpolated values appended to the key, so tests can see counts and amounts.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' | ')}` : key),
    i18n: { language: 'pt-BR' },
  }),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const mockApi = vi.mocked(api);
// Testing Library collapses the non-breaking space in "10,00 €" to a plain one.
const euro = (n: string) => `${n} €`;

const noGi = {
  id: 'ag1',
  name: 'No Gi',
  sharePercent: 50,
  addOnPrice: '10.00',
  active: true,
  teachers: [
    { id: 't1', name: 'Reynaldo Costa' },
    { id: 't2', name: 'Alex Nunes' },
  ],
  students: { recruited: 3, addOn: 8 },
};
const tarde = {
  id: 'ag2',
  name: 'Tarde',
  sharePercent: 40,
  addOnPrice: null,
  active: true,
  teachers: [{ id: 't3', name: 'Madiba' }],
  students: { recruited: 2, addOn: 0 },
};
const antigo = { ...tarde, id: 'ag3', name: 'Antigo', active: false, students: { recruited: 0, addOn: 0 } };

const candidates = [
  { id: 'o1', name: 'Dono', role: 'owner' },
  { id: 't1', name: 'Reynaldo Costa', role: 'student' },
  { id: 't2', name: 'Alex Nunes', role: 'student' },
  { id: 't4', name: 'Bia Lima', role: 'student' },
];

let writeError: Error | null;

describe('AgreementsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeError = null;
    mockApi.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method) {
        if (writeError) {
          throw writeError;
        }
        return {} as any;
      }
      if (path === '/agreements') {
        return [antigo, noGi, tarde] as any;
      }
      if (path === '/teachers/candidates') {
        return candidates as any;
      }
      return [] as any;
    });
  });

  it('lists active agreements with share, teachers and counts; ended ones last', async () => {
    renderWithProviders(<AgreementsCard />);
    const names = await screen.findAllByRole('heading', { level: 3 });
    expect(names.map((n) => n.textContent)).toEqual(['No Gi', 'Tarde', 'Antigo']);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Reynaldo Costa · Alex Nunes')).toBeInTheDocument();
    expect(screen.getByText(`agreements.addOnChip ${euro('10,00')}`)).toBeInTheDocument();
    expect(screen.getAllByText('agreements.noAddOn')).toHaveLength(2);
    expect(screen.getByText('agreements.recruitedCount 3')).toBeInTheDocument();
    expect(screen.getByText('agreements.addOnCount 8')).toBeInTheDocument();
    expect(screen.getByText('agreements.ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Antigo/ })).not.toBeInTheDocument();
  });

  it('creates an agreement with teachers picked from active students', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgreementsCard />);
    await user.click(await screen.findByRole('button', { name: 'agreements.new' }));
    await user.type(screen.getByLabelText('agreements.name'), 'Manhã');
    const picker = screen.getByLabelText('agreements.pickTeacher');
    const options = () => [...document.querySelectorAll('#agreement-teacher-options option')].map((o) => o.getAttribute('value'));
    expect(options()).toContain('Bia Lima');
    expect(options()).not.toContain('Dono');
    // Typing filters; only an exact pick from the list adds the teacher.
    await user.type(picker, 'Bia');
    expect(screen.queryByRole('button', { name: 'agreements.removeTeacher' })).not.toBeInTheDocument();
    await user.type(picker, ' Lima');
    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
    expect(picker).toHaveValue('');
    expect(options()).not.toContain('Bia Lima');
    await user.clear(screen.getByLabelText('agreements.percent'));
    await user.type(screen.getByLabelText('agreements.percent'), '30');
    await user.click(screen.getByRole('switch', { name: 'agreements.addOn' }));
    await user.type(screen.getByLabelText('agreements.addOnPrice'), '20');
    expect(screen.getByText(`agreements.split ${euro('6,00')} | ${euro('14,00')}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'agreements.save' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/agreements', {
        method: 'POST',
        body: JSON.stringify({ name: 'Manhã', sharePercent: 30, addOnPrice: '20', teacherIds: ['t4'] }),
      });
      expect(toast.success).toHaveBeenCalledWith('agreements.saved');
    });
  });

  it('edits an agreement: removes a teacher and drops the add-on', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgreementsCard />);
    await user.click(await screen.findByRole('button', { name: /No Gi/ }));
    expect(screen.getByLabelText('agreements.name')).toHaveValue('No Gi');
    expect(screen.getByText(`agreements.split ${euro('5,00')} | ${euro('5,00')}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'agreements.removeTeacher Alex Nunes' }));
    await user.click(screen.getByRole('switch', { name: 'agreements.addOn' }));
    await user.click(screen.getByRole('button', { name: 'agreements.save' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/agreements/ag1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'No Gi', sharePercent: 50, addOnPrice: null, teacherIds: ['t1'] }),
      }),
    );
  });

  it('explains when the add-on still has students', async () => {
    writeError = new Error('AGREEMENT_HAS_ADD_ON_STUDENTS');
    const user = userEvent.setup();
    renderWithProviders(<AgreementsCard />);
    await user.click(await screen.findByRole('button', { name: /No Gi/ }));
    await user.click(screen.getByRole('switch', { name: 'agreements.addOn' }));
    await user.click(screen.getByRole('button', { name: 'agreements.save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('agreements.errors.hasAddOnStudents');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ends an agreement after confirming', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgreementsCard />);
    await user.click(await screen.findByRole('button', { name: /Tarde/ }));
    await user.click(screen.getByRole('button', { name: 'agreements.end' }));
    expect(mockApi).not.toHaveBeenCalledWith('/agreements/ag2/end', expect.anything());
    await user.click(await screen.findByRole('button', { name: 'agreements.endConfirm' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/agreements/ag2/end', { method: 'POST' });
      expect(toast.success).toHaveBeenCalledWith('agreements.endedToast');
    });
  });
});
