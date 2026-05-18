import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import MarketplacePage from '@/pages/marketplace/index';

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

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const mockProducts = [
  { id: 'pr1', name: 'Gi Kimono', description: 'White A2', price: 350, stock: 10 },
  { id: 'pr2', name: 'Rashguard', price: 120, stock: 5 },
];

describe('MarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
    mockApi.mockResolvedValue(mockProducts as any);
  });

  it('renders product cards with prices', async () => {
    renderWithProviders(<MarketplacePage />);
    expect(await screen.findByText('Gi Kimono')).toBeInTheDocument();
    expect(screen.getByText('Rashguard')).toBeInTheDocument();
    // Price displayed as R$ 350,00
    expect(screen.getByText('R$ 350,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 120,00')).toBeInTheDocument();
  });

  it('shows request button for students', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<MarketplacePage />);
    const buttons = await screen.findAllByText('marketplace.request');
    expect(buttons.length).toBe(2);
  });

  it('shows add product button for instructors', async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText('marketplace.addProduct')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<MarketplacePage />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });
});
