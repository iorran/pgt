import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import SeasonsPage from '@/pages/gamification/seasons';

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

const ownerSession = {
  data: { user: { id: 'u1', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('SeasonsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(ownerSession);
  });

  it('shows an empty state with the create CTA for owners', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<SeasonsPage />);
    expect(await screen.findByText('gamification.noSeasons')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'gamification.createSeason' })).toHaveLength(2);
  });

  it('formats season dates without shifting a day', async () => {
    mockApi.mockResolvedValue([
      { id: 's1', name: 'S1', startDate: '2026-01-01', endDate: '2026-06-30', active: true },
    ] as any);
    renderWithProviders(<SeasonsPage />);
    expect(await screen.findByText('01/01/2026 - 30/06/2026')).toBeInTheDocument();
  });

  it('pairs form labels with inputs and bounds end date by start date', async () => {
    const user = userEvent.setup();
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<SeasonsPage />);
    const [trigger] = await screen.findAllByRole('button', { name: 'gamification.createSeason' });
    await user.click(trigger);
    expect(await screen.findByLabelText('gamification.seasonName')).toBeInTheDocument();
    expect(screen.getByLabelText('gamification.prize')).toBeInTheDocument();
    expect(screen.getByLabelText('gamification.first')).toHaveAttribute('type', 'number');
    await user.type(screen.getByLabelText('gamification.startDate'), '2026-03-01');
    expect(screen.getByLabelText('gamification.endDate')).toHaveAttribute('min', '2026-03-01');
  });

  it('sends points keyed by podium position and shows them from that shape', async () => {
    const user = userEvent.setup();
    mockApi.mockImplementation(async (path: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return { id: 'new' } as any;
      }
      return [{ id: 's1', name: 'S1', startDate: '2026-01-01', endDate: '2026-12-31', active: true, pointsConfig: { 1: 12, 2: 8, 3: 4 } }] as any;
    });
    renderWithProviders(<SeasonsPage />);
    expect(await screen.findByText(/gamification\.first: 12/)).toBeInTheDocument();
    expect(screen.getByText(/gamification\.third: 4/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'gamification.createSeason' }));
    await user.type(await screen.findByLabelText('gamification.seasonName'), 'Ranking 2027');
    await user.type(screen.getByLabelText('gamification.startDate'), '2027-01-01');
    await user.type(screen.getByLabelText('gamification.endDate'), '2027-12-31');
    await user.click(screen.getByRole('button', { name: 'common.create' }));
    const post = mockApi.mock.calls.find(([, o]: any) => o?.method === 'POST');
    expect(JSON.parse((post![1] as any).body).pointsConfig).toEqual({ 1: 10, 2: 7, 3: 5 });
  });

  it('owner edits a season with PUT, then recalculates points with a toast', async () => {
    const user = userEvent.setup();
    const season = { id: 's1', name: 'S1', startDate: '2026-01-01', endDate: '2026-12-31', prize: 'Kimono', active: true, pointsConfig: { 1: 10, 2: 7, 3: 5 } };
    mockApi.mockImplementation(async (path: string, opts?: any) => {
      if (opts?.method === 'PUT') {
        return season as any;
      }
      if (opts?.method === 'POST') {
        return { updated: 4 } as any;
      }
      return [season] as any;
    });
    renderWithProviders(<SeasonsPage />);
    await user.click(await screen.findByRole('button', { name: 'common.edit' }));
    const name = await screen.findByLabelText('gamification.seasonName');
    expect(name).toHaveValue('S1');
    expect(screen.getByLabelText('gamification.prize')).toHaveValue('Kimono');
    const first = screen.getByLabelText('gamification.first');
    await user.clear(first);
    await user.type(first, '12');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/seasons/s1', expect.objectContaining({ method: 'PUT' })));
    const put = mockApi.mock.calls.find(([, o]: any) => o?.method === 'PUT');
    expect(JSON.parse((put![1] as any).body)).toMatchObject({
      name: 'S1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      prize: 'Kimono',
      pointsConfig: { 1: 12, 2: 7, 3: 5 },
    });
    expect(mockApi).not.toHaveBeenCalledWith('/seasons', expect.anything());

    expect(await screen.findByText('gamification.control.recalculateHelp')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'gamification.control.recalculate' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/seasons/s1/recalculate', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('gamification.control.recalculated'));
  });

  it('students do not get the season edit button', async () => {
    mockUseSession.mockReturnValue({ ...ownerSession, data: { user: { ...ownerSession.data.user, role: 'student' } } });
    mockApi.mockResolvedValue([{ id: 's1', name: 'S1', startDate: '2026-01-01', endDate: '2026-12-31' }] as any);
    renderWithProviders(<SeasonsPage />);
    await screen.findByText('S1');
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument();
  });
});
