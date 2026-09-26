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
  planName: 'Mensal',
  dueDay: 5,
  familyId: null,
  familyName: null,
  agreedPrice: '35.00',
  planPrice: '45.00',
  monthlyFee: '35.00',
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
    expect(await screen.findByText('belts.blue')).toBeInTheDocument();
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

  it('shows list price and monthly fee and saves the agreed price (empty = none)', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/families\.listPrice/)).toHaveTextContent(/45,00\s€/);
    expect(screen.getByText(/families\.monthlyFee/)).toHaveTextContent(/35,00\s€/);
    const input = screen.getByLabelText('families.agreedPrice');
    expect(input).toHaveValue(35);
    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: 'families.saveAgreedPrice' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/membership', {
        method: 'PUT',
        body: JSON.stringify({ agreedPrice: '30' }),
      }),
    );
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'families.saveAgreedPrice' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/students/s1/membership', {
        method: 'PUT',
        body: JSON.stringify({ agreedPrice: null }),
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
});
