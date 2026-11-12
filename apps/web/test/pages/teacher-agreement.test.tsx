import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithRoute } from '../render';
import TeacherAgreementPage from '@/pages/me/agreement';
import { shiftMonth, todayYmd } from '@/lib/format';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '@/lib/api';

const mockApi = vi.mocked(api);
const thisMonth = todayYmd().slice(0, 7);

const noGi = (confirmed: string | null) => ({
  agreement: {
    id: 'a1',
    name: 'No Gi',
    teachers: [
      { id: 't1', name: 'Reynaldo' },
      { id: 't2', name: 'Alex' },
    ],
  },
  month: thisMonth,
  confirmed,
  students: [
    { studentId: 's1', name: 'Pedro Lima', kind: 'recruited', checkins: 6, paid: true },
    { studentId: 's2', name: 'Ana Souza', kind: 'addOn', checkins: 4, paid: false },
    { studentId: 's3', name: 'Carla Dias', kind: 'addOn', checkins: 0, paid: true },
  ],
});

function renderPage() {
  return renderWithRoute(
    <Routes>
      <Route path="/me/agreement/:id" element={<TeacherAgreementPage />} />
    </Routes>,
    ['/me/agreement/a1'],
  );
}

describe('TeacherAgreementPage', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('shows the confirmed payout total and the Students by kind, with no fees', async () => {
    mockApi.mockResolvedValue([noGi('107.50')] as any);
    renderPage();
    expect(await screen.findByText('teacherAgreement.confirmedBy')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith(`/me/agreements?month=${thisMonth}`);
    expect(screen.getByText(/107,50/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /teacherAgreement.recruited/ })).toBeInTheDocument();
    const addOn = screen.getByRole('list', { name: /teacherAgreement.addOn/ });
    expect(within(addOn).getAllByRole('listitem')).toHaveLength(2);
    expect(within(addOn).getByText('Ana Souza').closest('li')).toHaveTextContent('teacherAgreement.pending');
    expect(screen.getByText('Pedro Lima').closest('li')).toHaveTextContent('teacherAgreement.paid');
    expect(screen.queryByText('teacherAgreement.notConfirmed')).not.toBeInTheDocument();
  });

  it('says the payout is not confirmed yet', async () => {
    mockApi.mockResolvedValue([noGi(null)] as any);
    renderPage();
    expect(await screen.findByText('teacherAgreement.notConfirmed')).toBeInTheDocument();
    expect(screen.getByText('teacherAgreement.notConfirmedHint')).toBeInTheDocument();
    expect(screen.queryByText('teacherAgreement.confirmedBy')).not.toBeInTheDocument();
  });

  it('moves back a month but never into the future', async () => {
    mockApi.mockResolvedValue([noGi(null)] as any);
    renderPage();
    await screen.findByText('Pedro Lima');
    const next = screen.getByRole('button', { name: 'finance.nextMonth' });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'finance.prevMonth' }));
    expect(mockApi).toHaveBeenCalledWith(`/me/agreements?month=${shiftMonth(thisMonth, -1)}`);
    expect(screen.getByRole('button', { name: 'finance.nextMonth' })).toBeEnabled();
  });

  it('says so when the agreement has nothing this month', async () => {
    mockApi.mockResolvedValue([] as any);
    renderPage();
    expect(await screen.findByText('teacherAgreement.empty')).toBeInTheDocument();
  });
});
