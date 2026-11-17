import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, renderWithRoute } from '../render';
import { pickOption } from '../pick-option';
import PayoutSheetsPage from '@/pages/billing/payout-sheets';
import PayoutSheetPage from '@/pages/billing/payout-sheet';
import MyPayoutPage from '@/pages/me/payout';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockApi = vi.mocked(api);

// Response shapes from the Payout Sheet contract.
const sheets = [
  {
    className: 'No Gi',
    teachers: ['Reynaldo', 'Alex'],
    students: 6,
    total: '27.50',
    status: 'draft',
  },
  {
    className: 'Gi Tarde',
    teachers: ['Madiba'],
    students: 9,
    total: null,
    status: 'empty',
  },
];

const history = [
  {
    month: '2026-06',
    classes: [{ className: 'No Gi', total: '32.50' }],
    confirmed: true,
  },
  { month: '2026-07', classes: [], confirmed: true },
  { month: '2026-08', classes: [], confirmed: true },
  { month: '2026-09', classes: [], confirmed: true },
  {
    month: '2026-10',
    classes: [
      { className: 'No Gi', total: '30.00' },
      { className: 'Gi Tarde', total: '55.00' },
    ],
    confirmed: true,
  },
  {
    month: '2026-11',
    classes: [{ className: 'No Gi', total: '27.50' }],
    confirmed: false,
  },
].reverse(); // The API sends history newest first.

const sheet = (status: 'draft' | 'confirmed') => ({
  className: 'No Gi',
  month: '2026-11',
  status,
  teachers: ['Reynaldo', 'Alex'],
  total: '27.50',
  rows: [
    {
      studentId: 's1',
      name: 'Ana Silva',
      belt: 'blue',
      checkins: 8,
      paid: true,
      monthlyFee: '55.00',
      amount: '5.00',
      addedByHand: false,
    },
    {
      studentId: 's2',
      name: 'Carla Mendes',
      belt: 'white',
      checkins: 0,
      paid: false,
      monthlyFee: '45.00',
      amount: null,
      addedByHand: true,
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 17, 12));
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' },
    },
    isPending: false,
  } as any);
});

describe('PayoutSheetsPage', () => {
  beforeEach(() => {
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/payout-sheets/history')) {
        return history as any;
      }
      return sheets as any;
    });
  });

  it('lists one card per class sheet of the month, linking to the sheet', async () => {
    renderWithProviders(<PayoutSheetsPage />);
    const card = await screen.findByRole('link', { name: /No Gi/ });
    expect(mockApi).toHaveBeenCalledWith('/payout-sheets?month=2026-11');
    expect(mockApi).toHaveBeenCalledWith('/payout-sheets/history?months=6');
    expect(card).toHaveAttribute('href', '/billing/payouts/2026-11/No%20Gi');
    expect(card).toHaveTextContent('Reynaldo, Alex');
    expect(card).toHaveTextContent(/27,50\s€/);
    expect(card).toHaveTextContent('finance.sheets.status.draft');
    expect(screen.getByRole('link', { name: /Gi Tarde/ })).toHaveTextContent('finance.sheets.status.empty');
  });

  it('draws the last 6 months by class and picks a month from the select or a bar', async () => {
    renderWithProviders(<PayoutSheetsPage />);
    expect(
      await screen.findAllByRole('button', {
        name: /^finance\.sheets\.barLabel/,
      }),
    ).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('finance.sheets.month'), {
      target: { value: '2026-09' },
    });
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/payout-sheets?month=2026-09'));
    fireEvent.click(screen.getAllByRole('button', { name: /^finance\.sheets\.barLabel/ })[4]);
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/payout-sheets?month=2026-10'));
  });

  it('says so when no class has a sheet this month', async () => {
    mockApi.mockImplementation(
      async (path: string) => (path.startsWith('/payout-sheets/history') ? history : []) as any,
    );
    renderWithProviders(<PayoutSheetsPage />);
    expect(await screen.findByText('finance.sheets.empty')).toBeInTheDocument();
  });
});

function renderSheet() {
  return renderWithRoute(
    <Routes>
      <Route path="/billing/payouts/:month/:className" element={<PayoutSheetPage />} />
    </Routes>,
    ['/billing/payouts/2026-11/No%20Gi'],
  );
}

describe('PayoutSheetPage', () => {
  const sheetPath = '/payout-sheets/2026-11/No%20Gi';
  let current: ReturnType<typeof sheet>;

  beforeEach(() => {
    current = sheet('draft');
    mockApi.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method) {
        return {} as any;
      }
      if (path.startsWith('/students')) {
        return [
          { id: 's1', name: 'Ana Silva', belt: 'blue' },
          { id: 's3', name: 'Diego Rocha', belt: 'white' },
        ] as any;
      }
      return current as any;
    });
  });

  it('shows one row per student with check-ins, paid, Monthly Fee and the amount', async () => {
    renderSheet();
    const ana = (await screen.findByText('Ana Silva')).closest('li')!;
    expect(mockApi).toHaveBeenCalledWith(sheetPath);
    expect(ana).toHaveTextContent('finance.sheets.paid');
    expect(ana).toHaveTextContent('finance.sheets.fee');
    expect(within(ana).getByRole('textbox')).toHaveValue('5,00');
    expect(screen.getByText('Carla Mendes').closest('li')).toHaveTextContent('finance.sheets.pending');
    expect(screen.getByText('finance.sheets.teachers')).toBeInTheDocument();
    expect(screen.getByText(/27,50\s€/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar|save/i })).toBeNull();
  });

  it('autosaves an amount on blur, accepting a comma', async () => {
    renderSheet();
    const input = within((await screen.findByText('Carla Mendes')).closest('li')!).getByRole('textbox');
    fireEvent.change(input, { target: { value: '12,5' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/lines/s2`, {
        method: 'PUT',
        body: JSON.stringify({ amount: '12.50' }),
      }),
    );
    expect(await screen.findByText('finance.sheets.saved')).toBeInTheDocument();
  });

  it('clears an amount and skips saving when nothing changed', async () => {
    renderSheet();
    const input = within((await screen.findByText('Ana Silva')).closest('li')!).getByRole('textbox');
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/lines/s1`, {
        method: 'PUT',
        body: JSON.stringify({ amount: null }),
      }),
    );
    expect(mockApi.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(1);
  });

  it('adds a student without check-in and removes one added by hand', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText('Ana Silva');
    expect(within(screen.getByText('Ana Silva').closest('li')!).queryByRole('button')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'finance.sheets.remove' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/lines/s2`, {
        method: 'DELETE',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'finance.sheets.addStudent' }));
    await pickOption(user, 'finance.sheets.pickStudent', 'Die', 'Diego Rocha');
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/lines`, {
        method: 'POST',
        body: JSON.stringify({ studentId: 's3' }),
      }),
    );
  });

  it('confirms the month', async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'finance.sheets.confirm' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/confirm`, {
        method: 'POST',
      }),
    );
  });

  it('shows a confirmed sheet read-only, with Reabrir', async () => {
    current = sheet('confirmed');
    renderSheet();
    const ana = (await screen.findByText('Ana Silva')).closest('li')!;
    expect(within(ana).queryByRole('textbox')).toBeNull();
    expect(ana).toHaveTextContent(/5,00\s€/);
    expect(screen.queryByRole('button', { name: 'finance.sheets.addStudent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'finance.sheets.remove' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'finance.sheets.reopen' }));
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(`${sheetPath}/reopen`, {
        method: 'POST',
      }),
    );
  });
});

describe('MyPayoutPage', () => {
  const mine = [
    {
      className: 'No Gi',
      history: [
        { month: '2026-06', total: '32.50', confirmed: true },
        { month: '2026-07', total: null, confirmed: false },
        { month: '2026-08', total: '15.00', confirmed: true },
        { month: '2026-09', total: '37.50', confirmed: true },
        { month: '2026-10', total: '30.00', confirmed: true },
        { month: '2026-11', total: '27.50', confirmed: false },
      ],
    },
    {
      className: 'Gi Tarde',
      history: [{ month: '2026-11', total: '10.00', confirmed: true }],
    },
  ];
  mine[0].history.reverse(); // newest first, as the API sends it
  const teacherSheet = (month: string, status: string) => {
    const { rows, ...rest } = sheet('draft');
    return {
      ...rest,
      month,
      status,
      rows: rows.map(({ monthlyFee: _fee, ...r }) => r),
    };
  };

  beforeEach(() => {
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/me/payout-sheets') {
        return mine as any;
      }
      const month = path.split('/')[3];
      return teacherSheet(month, month === '2026-11' ? 'draft' : 'confirmed') as any;
    });
  });

  it('opens the latest month of the first class, says it is a draft and never shows a fee', async () => {
    renderWithProviders(<MyPayoutPage />);
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/me/payout-sheets/2026-11/No%20Gi');
    expect(screen.getByText('myPayout.draft')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent(/5,00\s€/);
    expect(screen.queryByText(/55,00/)).toBeNull();
    expect(screen.queryByText(/finance\.sheets\.fee/)).toBeNull();
  });

  it('picks a month by tapping its bar and a class from the select', async () => {
    renderWithProviders(<MyPayoutPage />);
    await screen.findByText('Ana Silva');
    fireEvent.click(screen.getAllByRole('button', { name: /^myPayout\.bar/ })[4]);
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/me/payout-sheets/2026-10/No%20Gi'));
    await waitFor(() => expect(screen.queryByText('myPayout.draft')).toBeNull());
    fireEvent.change(screen.getByLabelText('myPayout.class'), {
      target: { value: 'Gi Tarde' },
    });
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/me/payout-sheets/2026-11/Gi%20Tarde'));
  });

  it('hides the class select for a teacher of one class', async () => {
    mockApi.mockImplementation(
      async (path: string) => (path === '/me/payout-sheets' ? [mine[0]] : teacherSheet('2026-11', 'draft')) as any,
    );
    renderWithProviders(<MyPayoutPage />);
    await screen.findByText('Ana Silva');
    expect(screen.queryByLabelText('myPayout.class')).toBeNull();
  });
});
