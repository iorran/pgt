import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import BillingOverduePage from '@/pages/billing/index';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const session = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockRecords = [
  { kind: 'student', studentId: 's1', studentName: 'Carlos', belt: 'blue', planName: 'Monthly', daysOverdue: 5, missedMonths: ['2026-09'], phone: '+351 912 345 678', amountDue: '45.00' },
  { kind: 'student', studentId: 's2', studentName: 'Ana', belt: 'purple', planName: 'Quarterly', daysOverdue: 12, missedMonths: ['2026-08', '2026-09'], phone: null, amountDue: '90.00' },
];

const familyRecord = {
  kind: 'family',
  familyId: 'f1',
  familyName: 'Família Silva',
  members: [
    { studentId: 's3', name: 'Bia' },
    { studentId: 's4', name: 'Leo' },
  ],
  phone: '934 232 146',
  daysOverdue: 20,
  missedMonths: ['2026-08', '2026-09'],
  amountDue: '140.00',
};

describe('BillingOverduePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(session);
    mockApi.mockResolvedValue(mockRecords as any);
  });

  it('renders page title with count badge', async () => {
    renderWithProviders(<BillingOverduePage />);
    await waitFor(() => {
      expect(screen.getByText('billing.overdueTitle')).toBeInTheDocument();
      expect(screen.getByText('billing.overdueCount')).toBeInTheDocument();
    });
  });

  it('shows overdue student cards after fetch', async () => {
    renderWithProviders(<BillingOverduePage />);
    expect(await screen.findByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
  });

  it('shows days overdue in each card', async () => {
    renderWithProviders(<BillingOverduePage />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
    const labels = screen.getAllByText('billing.daysOverdue');
    expect(labels.length).toBe(2);
  });

  it('shows empty state when no overdue', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<BillingOverduePage />);
    expect(await screen.findByText('billing.noOverdue')).toBeInTheDocument();
  });

  it('shows translated belt and missed months', async () => {
    renderWithProviders(<BillingOverduePage />);
    expect(await screen.findByText('belts.blue')).toBeInTheDocument();
    expect(screen.getAllByText('billing.missedMonths')).toHaveLength(2);
  });

  it('links to WhatsApp when a phone exists', async () => {
    renderWithProviders(<BillingOverduePage />);
    await screen.findByText('Carlos');
    const links = screen.getAllByRole('link', { name: /WhatsApp/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://wa.me/351912345678');
  });

  it('records a quick payment from the card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BillingOverduePage />);
    await screen.findByText('Carlos');
    await user.click(screen.getAllByRole('button', { name: 'billing.recordPayment' })[0]);
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/payments/quick/s1', expect.objectContaining({ method: 'POST' }));
      expect(toast.success).toHaveBeenCalledWith('billing.paymentRecorded');
    });
  });

  it('shows the amount due on student cards', async () => {
    renderWithProviders(<BillingOverduePage />);
    await screen.findByText('Carlos');
    expect(screen.getByText(formatMoney('45.00', 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
    expect(screen.getByText(formatMoney('90.00', 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
  });

  describe('family cards', () => {
    beforeEach(() => {
      mockApi.mockImplementation(async (path: string) => {
        if (path.startsWith('/payments/overdue')) {
          return [familyRecord, ...mockRecords] as any;
        }
        return {} as any;
      });
    });

    it('renders one card per family with members, months and total', async () => {
      renderWithProviders(<BillingOverduePage />);
      expect(await screen.findByText('Família Silva')).toBeInTheDocument();
      expect(screen.getByText('Bia, Leo')).toBeInTheDocument();
      expect(screen.getAllByText('Bia, Leo')).toHaveLength(1);
      expect(screen.getByText(formatMoney('140.00', 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getAllByText('billing.missedMonths')).toHaveLength(3);
    });

    it('does not repeat members as student cards and counts cards', async () => {
      renderWithProviders(<BillingOverduePage />);
      await screen.findByText('Família Silva');
      expect(screen.queryByText('Bia')).not.toBeInTheDocument();
      expect(screen.queryByText('Leo')).not.toBeInTheDocument();
      expect(screen.getAllByText('billing.daysOverdue')).toHaveLength(3);
    });

    it('links the family phone to WhatsApp', async () => {
      renderWithProviders(<BillingOverduePage />);
      await screen.findByText('Família Silva');
      const hrefs = screen.getAllByRole('link', { name: /WhatsApp/ }).map((a) => a.getAttribute('href'));
      expect(hrefs).toContain('https://wa.me/934232146');
    });

    it('opens the family payment dialog', async () => {
      const user = userEvent.setup();
      mockApi.mockImplementation(async (path: string) => {
        if (path.startsWith('/payments/overdue')) {
          return [familyRecord] as any;
        }
        if (path === '/families/f1/billing') {
          return { owedMonths: [], suggestedMonths: [], suggestedAmount: '0.00' } as any;
        }
        return {} as any;
      });
      renderWithProviders(<BillingOverduePage />);
      await user.click(await screen.findByRole('button', { name: 'billing.family.recordPayment' }));
      expect(await screen.findByText('billing.family.dialogTitle')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith('/families/f1/billing');
      });
    });
  });
});
