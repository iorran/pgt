import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithRoute } from '../render';
import SeminarPage from '@/pages/classes/seminar';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'o1', role: 'owner', academyId: 'a1', status: 'active' } },
    isPending: false,
  })),
}));

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { api } from '@/lib/api';
const mockApi = vi.mocked(api);

const seminar = {
  id: 's1',
  name: 'Passagem de guarda',
  type: 'gi',
  recurrence: 'once',
  dayOfWeek: 6,
  date: '2026-11-14',
  startTime: '10:00',
  endTime: '13:00',
  isSeminar: true,
  studentPrice: '40.00',
  outsiderPrice: '50.00',
  teacher: null,
  guestTeacherName: 'Ricardo Almeida',
};

const participants = [
  { id: 'p1', kind: 'student', studentId: 'u1', name: 'João Silva', phone: null, amount: '40.00', paidAt: null },
  { id: 'p2', kind: 'outsider', studentId: null, name: 'Marta Sousa', phone: '912345678', amount: '50.00', paidAt: '2026-11-08' },
];

function renderPage() {
  return renderWithRoute(
    <Routes>
      <Route path="/classes/seminars/:id" element={<SeminarPage />} />
    </Routes>,
    ['/classes/seminars/s1'],
  );
}

describe('SeminarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockImplementation(async (path: string) =>
      (path.startsWith('/classes') ? [seminar] : path === '/seminars/s1/participants' ? participants : {}) as any,
    );
  });

  it('shows the guest teacher, the participants and the money received and pending', async () => {
    renderPage();
    expect(await screen.findByText('Marta Sousa')).toBeInTheDocument();
    expect(screen.getByText('classes.teacher.guest')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('seminars.received')).toBeInTheDocument();
    expect(screen.getByText('seminars.pendingTotal')).toBeInTheDocument();
  });

  it('marks a pending participant as paid', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'seminars.markPaid' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/seminar-participants/p1', {
        method: 'PATCH',
        body: JSON.stringify({ paid: true }),
      }),
    );
  });

  it('adds an outsider by name and phone', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'seminars.addOutsider' }));
    await user.type(screen.getByLabelText('seminars.name'), 'Pedro Nunes');
    await user.type(screen.getByLabelText('seminars.phone'), '913000000');
    await user.click(screen.getByRole('button', { name: 'seminars.save' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/seminars/s1/participants', {
        method: 'POST',
        body: JSON.stringify({ name: 'Pedro Nunes', phone: '913000000' }),
      }),
    );
  });
});
