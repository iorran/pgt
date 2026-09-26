import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import FamilyPaymentDialog from '@/pages/billing/family-payment-dialog';
import { todayYmd } from '@/lib/format';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

const mockApi = vi.mocked(api);

const members = [
  { studentId: 's1', name: 'Bia' },
  { studentId: 's2', name: 'Leo' },
  { studentId: 's3', name: 'Carlos' },
];

const billing = {
  owedMonths: [
    {
      month: '2026-08',
      fee: '70.00',
      members: [
        { studentId: 's1', status: 'owed' },
        { studentId: 's2', status: 'owed' },
        { studentId: 's3', status: 'not-billed' },
      ],
    },
    {
      month: '2026-09',
      fee: '35.00',
      members: [
        { studentId: 's1', status: 'owed' },
        { studentId: 's2', status: 'waived' },
        { studentId: 's3', status: 'paid' },
      ],
    },
    {
      month: '2026-10',
      fee: '40.00',
      members: [{ studentId: 's1', status: 'owed' }],
    },
  ],
  suggestedMonths: ['2026-08', '2026-09'],
  suggestedAmount: '105.00',
};

function renderDialog(onOpenChange = vi.fn()) {
  renderWithProviders(
    <FamilyPaymentDialog familyId="f1" familyName="Família Silva" members={members} open onOpenChange={onOpenChange} />,
  );
  return onOpenChange;
}

describe('FamilyPaymentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/families/f1/billing') {
        return billing as any;
      }
      return {} as any;
    });
  });

  it('pre-selects the suggested months and pre-fills the amount', async () => {
    renderDialog();
    expect(await screen.findByRole('checkbox', { name: /2026-08/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /2026-09/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /2026-10/ })).not.toBeChecked();
    expect(screen.getByLabelText('billing.amount')).toHaveValue(105);
    expect(screen.getByLabelText('billing.date')).toHaveValue(todayYmd());
  });

  it('shows member statuses per month', async () => {
    renderDialog();
    await screen.findByRole('checkbox', { name: /2026-09/ });
    expect(screen.getByText('Leo · billing.family.status.waived')).toBeInTheDocument();
    expect(screen.getByText('Carlos · billing.family.status.paid')).toBeInTheDocument();
  });

  it('labels a partly paid month', async () => {
    renderDialog();
    await screen.findByRole('checkbox', { name: /2026-09/ });
    // Only Sep has a paid member.
    expect(screen.getAllByText('billing.family.partlyPaid')).toHaveLength(1);
  });

  it('recomputes the amount when the selection changes', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('checkbox', { name: /2026-10/ }));
    expect(screen.getByLabelText('billing.amount')).toHaveValue(145);
    await user.click(screen.getByRole('checkbox', { name: /2026-08/ }));
    expect(screen.getByLabelText('billing.amount')).toHaveValue(75);
  });

  it('keeps a manually edited amount when the selection changes', async () => {
    const user = userEvent.setup();
    renderDialog();
    const amount = await screen.findByLabelText('billing.amount');
    await user.clear(amount);
    await user.type(amount, '100');
    await user.click(screen.getByRole('checkbox', { name: /2026-10/ }));
    expect(amount).toHaveValue(100);
  });

  it('disables submit with no months selected', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('checkbox', { name: /2026-08/ }));
    await user.click(screen.getByRole('checkbox', { name: /2026-09/ }));
    expect(screen.getByRole('button', { name: 'billing.family.submit' })).toBeDisabled();
  });

  it('submits months, amount and date, then closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = renderDialog();
    await user.click(await screen.findByRole('checkbox', { name: /2026-10/ }));
    await user.click(screen.getByRole('button', { name: 'billing.family.submit' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/families/f1/payments', expect.objectContaining({ method: 'POST' }));
    });
    const call = mockApi.mock.calls.find(([path]) => path === '/families/f1/payments')!;
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      months: ['2026-08', '2026-09', '2026-10'],
      amount: '145.00',
      paymentDate: todayYmd(),
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('billing.family.paymentRecorded');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows a translated error when the payment fails', async () => {
    const user = userEvent.setup();
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/families/f1/billing') {
        return billing as any;
      }
      throw new Error('Request failed');
    });
    renderDialog();
    await user.click(await screen.findByRole('button', { name: 'billing.family.submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('billing.family.paymentError');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
