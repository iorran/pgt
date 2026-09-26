import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatMoney } from '@/lib/format';
import { renderWithProviders } from '../render';
import PlansPage from '@/pages/billing/plans';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockPlans = [
  { id: 'p1', name: 'Basic', price: 150, frequency: 'monthly', classesPerWeek: 3 },
  { id: 'p2', name: 'Premium', price: 250, frequency: 'monthly', classesPerWeek: 5 },
];

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockPlans as any);
  });

  it('renders plan cards with prices', async () => {
    renderWithProviders(<PlansPage />);
    expect(await screen.findByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    // formatPrice uses pt-BR locale: R$ 150,00
    expect(screen.getByText((content) => content.includes('150'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('250'))).toBeInTheDocument();
  });

  it('shows create button for instructors', async () => {
    renderWithProviders(<PlansPage />);
    await waitFor(() => {
      expect(screen.getByText('billing.createPlan')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<PlansPage />);
    expect(await screen.findByText('billing.noPlans')).toBeInTheDocument();
  });

  it('formats string prices as money and translates frequency', async () => {
    mockApi.mockResolvedValue([
      { id: 'p3', name: 'Bolsa', price: '0.00', frequency: 'monthly', classesPerWeek: null },
    ] as any);
    renderWithProviders(<PlansPage />);
    expect(await screen.findByText(formatMoney('0.00', 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
    expect(screen.getByText('billing.monthly')).toBeInTheDocument();
    expect(screen.queryByText('monthly')).toBeNull();
    expect(screen.getByText('billing.unlimitedClasses')).toBeInTheDocument();
  });

  it('associates form labels with inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />);
    await user.click(await screen.findByRole('button', { name: 'billing.createPlan' }));
    expect(await screen.findByLabelText('billing.planName')).toBeInTheDocument();
    expect(screen.getByLabelText('billing.price')).toBeInTheDocument();
    expect(screen.getByLabelText('billing.frequency')).toBeInTheDocument();
    expect(screen.getByLabelText('billing.classesPerWeek')).toBeInTheDocument();
  });
});
