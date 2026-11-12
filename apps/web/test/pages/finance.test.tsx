import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import BalancePage, { balanceCsvRows } from '@/pages/billing/balance';
import ExpensesPage from '@/pages/billing/expenses';
import PayoutsPage, { payoutCsvRows } from '@/pages/billing/payouts';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockApi = vi.mocked(api);
const t = (key: string) => key;

// Real response shapes of /api/finance/*.

const balance = {
  month: '2026-10',
  income: {
    monthlyFees: { amount: '90.00', students: 2 },
    addOns: { amount: '10.00', count: 1 },
    seminars: { amount: '30.00', count: 1 },
    total: '130.00',
  },
  expenses: {
    total: '1379.10',
    items: [
      { description: 'Renda', amount: '1200.00' },
      { description: 'Luz', amount: '94.10' },
      { description: 'Internet', amount: '35.00' },
      { description: 'Água', amount: '30.00' },
      { description: 'Limpeza', amount: '20.00' },
    ],
  },
  payouts: { total: '27.50' },
  result: '-1276.60',
  history: [
    { month: '2026-05', result: '0.00' },
    { month: '2026-06', result: '0.00' },
    { month: '2026-07', result: '0.00' },
    { month: '2026-08', result: '0.00' },
    { month: '2026-09', result: '42.50' },
    { month: '2026-10', result: '-1276.60' },
  ],
};

const expenses = {
  month: '2026-10',
  expenses: [
    { id: 'e1', description: 'Renda', amount: '1200.00', oneOff: false, confirmed: false },
    { id: 'e2', description: 'Tatame novo', amount: '340.00', oneOff: true, confirmed: true },
  ],
};

const payout = {
  agreement: {
    id: 'g1',
    name: 'No Gi',
    sharePercent: 50,
    active: true,
    teachers: [
      { id: 't1', name: 'Reynaldo' },
      { id: 't2', name: 'Alex' },
    ],
  },
  addOn: { count: 1, price: '10.00', share: '5.00', amount: '5.00' },
  recruited: { paid: '45.00', percent: 50, amount: '22.50' },
  suggested: '27.50',
  confirmed: null,
  amount: '27.50',
  missingCheckins: ['Marta'],
  walkIns: [{ studentId: 's9', name: 'Bruno', checkins: 3 }],
  students: [
    {
      studentId: 's1',
      name: 'Marta',
      kind: 'addOn',
      monthlyFee: '45.00',
      checkins: 0,
      paid: '55.00',
      payout: '5.00',
      payments: [{ amount: '55.00', paymentDate: '2026-10-05', referenceMonth: '2026-10', payout: '5.00' }],
    },
    {
      studentId: 's3',
      name: 'Diogo',
      kind: 'recruited',
      monthlyFee: '45.00',
      checkins: 2,
      paid: '0.00',
      payout: '0.00',
      payments: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
    isPending: false,
  } as any);
  mockApi.mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method) {
      return {} as any;
    }
    if (path.startsWith('/finance/balance')) {
      return balance as any;
    }
    if (path.startsWith('/finance/expenses')) {
      return expenses as any;
    }
    if (path.startsWith('/finance/payouts')) {
      return [payout] as any;
    }
    return [] as any;
  });
});

describe('BalancePage', () => {
  it('shows the result, the totals and the largest expenses of the current month', async () => {
    renderWithProviders(<BalancePage />);
    expect(await screen.findByText(/1276,60\s€/)).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/finance/balance?month=2026-10');
    expect(screen.getAllByText(/130,00\s€/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1379,10\s€/).length).toBeGreaterThan(0);
    const top = screen.getByRole('region', { name: 'finance.balance.topExpenses' });
    expect(within(top).getByText('Renda')).toBeInTheDocument();
    expect(within(top).queryByText('Limpeza')).toBeNull();
    expect(screen.getByRole('img', { name: 'finance.balance.historyLabel' })).toBeInTheDocument();
  });

  it('switches month', async () => {
    renderWithProviders(<BalancePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'finance.prevMonth' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/finance/balance?month=2026-09'));
  });

  it('exports income, every expense, payouts and the result', () => {
    expect(balanceCsvRows(balance, t)).toEqual([
      ['finance.csv.month', '2026-10'],
      [],
      ['finance.csv.monthlyFees', '90,00'],
      ['finance.csv.addOns', '10,00'],
      ['finance.csv.seminars', '30,00'],
      ['finance.csv.income', '130,00'],
      [],
      ['finance.csv.expense', 'finance.csv.amount'],
      ['Renda', '1200,00'],
      ['Luz', '94,10'],
      ['Internet', '35,00'],
      ['Água', '30,00'],
      ['Limpeza', '20,00'],
      ['finance.csv.expenses', '1379,10'],
      [],
      ['finance.csv.payouts', '27,50'],
      ['finance.csv.result', '-1276,60'],
    ]);
  });
});

describe('ExpensesPage', () => {
  it('greys copied rows, explains the copy and totals the month', async () => {
    renderWithProviders(<ExpensesPage />);
    const rent = await screen.findByLabelText('Renda');
    expect(rent).toHaveValue(1200);
    expect(rent).toHaveClass('text-muted-foreground');
    expect(screen.getByText('finance.expenses.copied')).toBeInTheDocument();
    expect(screen.getByText('finance.expenses.oneOffTag')).toBeInTheDocument();
    expect(screen.getByText(/1540,00\s€/)).toBeInTheDocument();
  });

  it('saves a cell on blur, which also confirms a copied value', async () => {
    renderWithProviders(<ExpensesPage />);
    const rent = await screen.findByLabelText('Renda');
    fireEvent.change(rent, { target: { value: '1250.5' } });
    fireEvent.blur(rent);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/finance/expenses/e1', { method: 'PUT', body: JSON.stringify({ amount: '1250.5' }) }),
    );
  });

  it('adds and removes rows', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderWithProviders(<ExpensesPage />);
    await screen.findByLabelText('Renda');
    await user.click(screen.getAllByRole('button', { name: 'finance.expenses.remove' })[0]);
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/finance/expenses/e1', { method: 'DELETE' }));

    await user.type(screen.getByLabelText('finance.expenses.newDescription'), 'Água');
    await user.type(screen.getByLabelText('finance.expenses.newAmount'), '32.15');
    await user.click(screen.getByLabelText('finance.expenses.oneOff'));
    await user.click(screen.getByRole('button', { name: 'finance.expenses.addRow' }));
    await waitFor(() => {
      const post = mockApi.mock.calls.find(([path, options]) => path === '/finance/expenses' && options?.method === 'POST');
      expect(JSON.parse(post![1]!.body as string)).toEqual({
        month: expect.stringMatching(/^\d{4}-\d{2}$/),
        description: 'Água',
        amount: '32.15',
        oneOff: true,
      });
    });
  });
});

describe('PayoutsPage', () => {
  it('shows one card per agreement with the suggestion, the owner notes and the students', async () => {
    renderWithProviders(<PayoutsPage />);
    expect(await screen.findByRole('heading', { name: 'No Gi' })).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.sub')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.pending')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.addOnLine')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.recruitedLine')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.missingCheckins')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.walkIns')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.ownerOnly')).toBeInTheDocument();
    expect(screen.getByLabelText('finance.payouts.amountLabel')).toHaveValue(27.5);
    expect(screen.getByText('Marta')).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.notPaid')).toBeInTheDocument();
  });

  it('confirms the amount the Owner typed', async () => {
    renderWithProviders(<PayoutsPage />);
    const input = await screen.findByLabelText('finance.payouts.amountLabel');
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'finance.payouts.confirm' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith('/finance/payouts', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'g1', month: '2026-10', amount: '30' }),
      }),
    );
  });

  it('hides the add-on line and the notes when the agreement has no add-on and nothing to flag', async () => {
    mockApi.mockImplementation(async (path: string) =>
      path.startsWith('/finance/payouts')
        ? ([
            {
              ...payout,
              agreement: { ...payout.agreement, name: 'Tarde' },
              addOn: { count: 0, price: null, share: '0.00', amount: '0.00' },
              missingCheckins: [],
              walkIns: [],
              students: [payout.students[1]],
            },
          ] as any)
        : ([] as any),
    );
    renderWithProviders(<PayoutsPage />);
    expect(await screen.findByRole('heading', { name: 'Tarde' })).toBeInTheDocument();
    expect(screen.getByText('finance.payouts.recruitedLine')).toBeInTheDocument();
    expect(screen.queryByText('finance.payouts.addOnLine')).toBeNull();
    expect(screen.queryByText('finance.payouts.ownerOnly')).toBeNull();
  });

  it('exports one row per payment, unpaid students, totals and the payout', () => {
    expect(payoutCsvRows({ ...payout, confirmed: '30.00', amount: '30.00' }, '2026-10', t)).toEqual([
      ['No Gi', '2026-10'],
      [],
      [
        'finance.csv.student',
        'finance.csv.monthlyFee',
        'finance.csv.paid',
        'finance.csv.paymentDate',
        'finance.csv.referenceMonth',
        'finance.csv.kind',
        'finance.csv.payout',
      ],
      ['Marta', '45,00', '55,00', '2026-10-05', '2026-10', 'finance.csv.kindAddOn', '5,00'],
      ['Diogo', '45,00', '0,00', '', '', 'finance.csv.kindRecruited', '0,00'],
      [],
      ['finance.csv.totalPaid', '', '55,00', '', '', '', '5,00'],
      ['finance.csv.suggested', '27,50'],
      ['finance.csv.payoutAmount', '30,00'],
    ]);
  });
});
