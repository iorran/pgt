import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithRoute } from '../render';
import StudentDetailPage from '@/pages/students/detail';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const session = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

let student: any;
const baseStudent = {
  id: 's1',
  name: 'Ana',
  email: 'ana@import.local',
  belt: 'blue',
  dueDay: 5,
  familyId: null,
  familyName: null,
  monthlyFee: '35.00',
  modalities: [{ id: 'm1', name: 'Jiu-Jitsu' }],
  trainingNote: 'turma das 7h',
};

const renderPage = () =>
  renderWithRoute(
    <Routes>
      <Route path="/students/:id" element={<StudentDetailPage />} />
    </Routes>,
    ['/students/s1'],
  );

describe('StudentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue(session);
    student = { ...baseStudent };
    vi.mocked(api).mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method) {
        return {};
      }
      if (path === '/students/s1/waived-months') {
        return [{ referenceMonth: '2026-08', reason: 'Lesão' }];
      }
      if (path === '/modalities') {
        return [
          { id: 'm1', name: 'Jiu-Jitsu', studentCount: 3 },
          { id: 'm2', name: 'MMA', studentCount: 1 },
        ];
      }
      if (path === '/families') {
        return [{ id: 'f1', name: 'Família Silva', members: [] }];
      }
      if (path === '/students/s1') {
        return student;
      }
      if (path === '/payments/student/s1') {
        return [{ id: 'p1', amount: '45.00', paymentDate: '2026-09-01', referenceMonth: '2026-09' }];
      }
      if (path.startsWith('/gamification')) {
        return { xp: 0, streak: { currentStreak: 0, longestStreak: 0 }, badges: [] };
      }
      return [];
    });
  });

  it('translates the belt, hides placeholder .local emails and formats money in EUR', async () => {
    renderPage();
    expect(await screen.findByText('belts.blue', { ignore: 'option' })).toBeInTheDocument();
    expect(screen.queryByText('ana@import.local')).toBeNull();
    expect(screen.getAllByText(/45,00\s€/).length).toBeGreaterThan(0);
  });

  it('asks for confirmation before paying the current month and toasts on success', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'students.payCurrentMonth' }));
    expect(api).not.toHaveBeenCalledWith('/payments/quick/s1', expect.anything());
    fireEvent.click(await screen.findByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/payments/quick/s1', { method: 'POST' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('students.paySuccess'));
  });

  it('links to Famílias when the student has a family', async () => {
    student = { ...baseStudent, familyId: 'f1', familyName: 'Família Silva' };
    renderPage();
    expect(await screen.findByRole('link', { name: 'Família Silva' })).toHaveAttribute('href', '/students/families');
    expect(screen.queryByRole('button', { name: 'families.addToFamily' })).toBeNull();
  });

  it('adds a student without a family to an existing family', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'families.addToFamily' }));
    await user.selectOptions(await screen.findByLabelText('families.existingFamily'), 'f1');
    await user.click(screen.getByRole('button', { name: 'families.add' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families/f1/members', { method: 'POST', body: JSON.stringify({ studentId: 's1' }) }),
    );
  });

  it('creates a new family with this student', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'families.addToFamily' }));
    // Base UI's delayed initial focus can steal keystrokes from user.type here.
    fireEvent.change(screen.getByLabelText('families.name'), { target: { value: 'Família Costa' } });
    await user.click(screen.getByRole('button', { name: 'common.create' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/families', {
        method: 'POST',
        body: JSON.stringify({ name: 'Família Costa', memberIds: ['s1'] }),
      }),
    );
  });

  it('shows the monthly fee and saves it with the due day via one-tap suggestions', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByLabelText('students.fee.amount');
    expect(input).toHaveValue(35);
    expect(screen.getByRole('button', { name: /^35,00\s€/ })).toHaveAttribute('aria-pressed', 'true');
    const chip45 = screen.getByRole('button', { name: /^45,00\s€/ });
    expect(chip45).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^65,00\s€/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^60,00\s€/ })).toBeInTheDocument();
    await user.click(chip45);
    expect(input).toHaveValue(45);
    expect(chip45).toHaveAttribute('aria-pressed', 'true');
    const dueDay = screen.getByLabelText('students.dueDay');
    expect(dueDay).toHaveValue(5);
    expect(dueDay).toHaveAttribute('min', '1');
    expect(dueDay).toHaveAttribute('max', '28');
    await user.clear(dueDay);
    await user.type(dueDay, '10');
    await user.click(screen.getByRole('button', { name: 'students.fee.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/membership', {
        method: 'PUT',
        body: JSON.stringify({ monthlyFee: '45', dueDay: 10 }),
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('students.fee.saved'));
  });

  it('shows "not billed" for a student without a monthly fee and can set one', async () => {
    const user = userEvent.setup();
    student = { ...baseStudent, monthlyFee: null, dueDay: null };
    renderPage();
    expect(await screen.findByText('students.fee.none')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'students.payCurrentMonth' })).toBeNull();
    expect(screen.getByLabelText('students.fee.amount')).toHaveValue(null);
    expect(screen.getByLabelText('students.dueDay')).toHaveValue(8);
    await user.type(screen.getByLabelText('students.fee.amount'), '60');
    await user.click(screen.getByRole('button', { name: 'students.fee.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/membership', {
        method: 'PUT',
        body: JSON.stringify({ monthlyFee: '60', dueDay: 8 }),
      }),
    );
  });

  it('saves modalities and the training note', async () => {
    const user = userEvent.setup();
    renderPage();
    const jj = await screen.findByRole('checkbox', { name: 'Jiu-Jitsu' });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'MMA' })).toBeInTheDocument());
    expect(jj).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'MMA' })).not.toBeChecked();
    const note = screen.getByLabelText('students.training.note');
    expect(note).toHaveValue('turma das 7h');
    await user.click(screen.getByRole('checkbox', { name: 'MMA' }));
    await user.click(jj);
    await user.clear(note);
    await user.type(note, 'trânsito livre');
    await user.click(screen.getByRole('button', { name: 'students.training.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/training', {
        method: 'PUT',
        body: JSON.stringify({ modalityIds: ['m2'], trainingNote: 'trânsito livre' }),
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('students.training.saved'));
    await user.clear(note);
    await user.click(screen.getByRole('button', { name: 'students.training.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/training', {
        method: 'PUT',
        body: JSON.stringify({ modalityIds: ['m2'], trainingNote: null }),
      }),
    );
  });

  it('lists, waives and unwaives months', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Lesão/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'families.unwaive 2026-08' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/students/s1/waived-months/2026-08', { method: 'DELETE' }));

    fireEvent.change(screen.getByLabelText('families.month'), { target: { value: '2026-10' } });
    await user.type(screen.getByLabelText('families.reason'), 'Férias');
    await user.click(screen.getByRole('button', { name: 'families.waiveMonth' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/waived-months', {
        method: 'POST',
        body: JSON.stringify({ month: '2026-10', reason: 'Férias' }),
      }),
    );
  });

  it('lets the owner change the belt (grouped Infantil / Adulto) and toasts', async () => {
    const user = userEvent.setup();
    renderPage();
    const select = await screen.findByLabelText('students.belt');
    expect(select).toHaveValue('blue');
    expect(screen.getByRole('group', { name: 'beltGroups.kids' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'beltGroups.adult' })).toBeInTheDocument();
    await user.selectOptions(select, 'orange-white');
    await user.click(screen.getByRole('button', { name: 'students.beltForm.save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/belt', {
        method: 'PUT',
        body: JSON.stringify({ belt: 'orange-white' }),
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('students.beltForm.saved'));
  });

  it('shows a kids belt badge translated and hides the belt control from students', async () => {
    vi.mocked(useSession).mockReturnValue({
      ...session,
      data: { user: { ...session.data.user, role: 'student' } },
    });
    student = { ...baseStudent, belt: 'grey-black' };
    renderPage();
    expect(await screen.findByText('belts.grey-black')).toBeInTheDocument();
    expect(screen.queryByLabelText('students.belt')).toBeNull();
    expect(screen.queryByRole('button', { name: 'students.beltForm.save' })).toBeNull();
  });
});
