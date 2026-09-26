import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import PaymentsPage from '@/pages/billing/payments';
import { formatDate, formatMoney } from '@/lib/format';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const session = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const students = [
  { id: 's1', name: 'Ana Silva', planName: 'Basic' },
  { id: 's2', name: 'Bruno Costa', planName: null },
];
const plans = [{ id: 'p1', name: 'Basic', price: '45.00', frequency: 'monthly', classesPerWeek: 3 }];
const payments = [{ id: 'pay1', studentId: 's1', amount: '45.00', paymentDate: '2026-04-23', referenceMonth: '2026-04' }];

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/students')) {
        return students as any;
      }
      if (path.startsWith('/membership-plans')) {
        return plans as any;
      }
      if (path.startsWith('/payments?')) {
        return payments as any;
      }
      return {} as any;
    });
  });

  it('defaults date to today and reference month to current month', async () => {
    renderWithProviders(<PaymentsPage />);
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(await screen.findByLabelText('billing.date')).toHaveValue(`${ym}-${String(now.getDate()).padStart(2, '0')}`);
    expect(screen.getByLabelText('billing.referenceMonth')).toHaveValue(ym);
  });

  it('formats money and dates in the history table', async () => {
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText(formatMoney('45.00', 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
    expect(screen.getByText(formatDate('2026-04-23', 'pt-BR'))).toBeInTheDocument();
    // student name resolved from the students list
    expect(screen.getByRole('cell', { name: 'Ana Silva' })).toBeInTheDocument();
  });

  it('searches student by name, prefills plan price, saves with toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentsPage />);
    const studentInput = await screen.findByLabelText('billing.selectStudent');
    await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(2));
    await user.type(studentInput, 'Ana Silva');
    await waitFor(() => expect(screen.getByLabelText('billing.amount')).toHaveValue(45));
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/payments',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('"studentId":"s1"') }),
      );
      expect(toast.success).toHaveBeenCalledWith('billing.paymentRecorded');
    });
  });
});
