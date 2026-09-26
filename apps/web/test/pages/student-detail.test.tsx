import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
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

const student = { id: 's1', name: 'Ana', email: 'ana@import.local', belt: 'blue', planName: 'Mensal', dueDay: 5 };

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
    vi.mocked(api).mockImplementation(async (path: string) => {
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
    expect(screen.getByText(/€\s*45,00/)).toBeInTheDocument();
  });

  it('asks for confirmation before paying the current month and toasts on success', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'students.payCurrentMonth' }));
    expect(api).not.toHaveBeenCalledWith('/payments/quick/s1', expect.anything());
    fireEvent.click(await screen.findByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/payments/quick/s1', { method: 'POST' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('students.paySuccess'));
  });
});
