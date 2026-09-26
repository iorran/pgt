import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatMoney } from '@/lib/format';
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
    expect(screen.getByText(formatMoney(350, 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
    expect(screen.getByText(formatMoney(120, 'pt-BR').replace(/\s/g, ' '))).toBeInTheDocument();
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
    expect(await screen.findByText('marketplace.noProducts')).toBeInTheDocument();
    // owner gets a CTA in the empty state as well as the header button
    expect(screen.getAllByRole('button', { name: 'marketplace.addProduct' })).toHaveLength(2);
  });

  it('associates form labels with inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText('Gi Kimono');
    await user.click(screen.getAllByRole('button', { name: 'marketplace.addProduct' })[0]);
    expect(await screen.findByLabelText('marketplace.productName')).toBeInTheDocument();
    expect(screen.getByLabelText('marketplace.description')).toBeInTheDocument();
    expect(screen.getByLabelText('marketplace.price')).toBeInTheDocument();
    expect(screen.getByLabelText('marketplace.stock')).toBeInTheDocument();
  });

  it('owner edits a product via PUT', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText('Gi Kimono');
    await user.click(screen.getAllByRole('button', { name: 'common.edit' })[0]);
    const name = await screen.findByLabelText('marketplace.productName');
    expect(name).toHaveValue('Gi Kimono');
    await user.clear(name);
    await user.type(name, 'Gi A3');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/products/pr1',
        expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"name":"Gi A3"') }),
      );
    });
  });

  it('owner deletes a product after confirming', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText('Gi Kimono');
    await user.click(screen.getAllByRole('button', { name: 'common.delete' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(mockApi).not.toHaveBeenCalledWith('/products/pr1', expect.objectContaining({ method: 'DELETE' }));
    await user.click(within(dialog).getByRole('button', { name: 'common.delete' }));
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/products/pr1', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  it('students do not see edit/delete', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<MarketplacePage />);
    await screen.findByText('Gi Kimono');
    expect(screen.queryByRole('button', { name: 'common.edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.delete' })).toBeNull();
  });
});
