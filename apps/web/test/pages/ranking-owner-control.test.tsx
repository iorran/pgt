import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ResultsPage from '@/pages/gamification/results';
import LeaderboardPage from '@/pages/gamification/leaderboard';

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

const ownerSession = {
  data: { user: { id: 'u1', name: 'Owner', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const seasons = [{ id: 's1', name: 'Season 2026', startDate: '2026-01-01', endDate: '2026-12-31' }];
const students = [
  { id: 'st1', name: 'Carlos' },
  { id: 'st2', name: 'Ana' },
];

const results = [
  { id: 'cr1', studentId: 'st1', competitionName: 'IBJJF Open', date: '2026-03-15', position: 1, status: 'approved', studentName: 'Carlos', pointsAwarded: 10, pointsOverridden: false },
  { id: 'cr2', studentId: 'st2', competitionName: 'Pontos acumulados', date: '2026-03-20', position: null, status: 'approved', studentName: 'Ana', pointsAwarded: 31, pointsOverridden: true },
];

const leaderboard = [
  { studentId: 'st1', rank: 1, studentName: 'Carlos', belt: 'black', totalPoints: 10 },
];

function routeApi() {
  mockApi.mockImplementation(async (path: string, opts?: any) => {
    if (opts?.method) {
      return {} as any;
    }
    if (path.startsWith('/seasons?')) {
      return seasons as any;
    }
    if (path.startsWith('/students?')) {
      return students as any;
    }
    if (path.includes('/leaderboard')) {
      return leaderboard as any;
    }
    if (path.startsWith('/competition-results?')) {
      return results as any;
    }
    return [] as any;
  });
}

function calls(method: string, path: string) {
  return mockApi.mock.calls.filter(([p, o]) => p === path && o?.method === method);
}

function bodyOf(method: string, path: string) {
  const [call] = calls(method, path);
  return call ? JSON.parse(call[1]!.body as string) : undefined;
}

function card(name: string) {
  return screen.getByText(name).closest('[data-slot="card"]') as HTMLElement;
}

describe('Resultados (owner control)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(ownerSession);
    routeApi();
  });

  it('filters by status: Pendentes by default, Todos omits status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    const pending = await screen.findByRole('button', { name: 'gamification.control.filter.pending' });
    expect(pending).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&status=pending'));

    await user.click(screen.getByRole('button', { name: 'gamification.control.filter.approved' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&status=approved'));
    expect(screen.getByRole('button', { name: 'gamification.control.filter.approved' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'gamification.control.filter.rejected' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&status=rejected'));

    await user.click(screen.getByRole('button', { name: 'gamification.control.filter.all' }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1'));
  });

  it('shows position or Ajuste, points and status; approve/reject only on pending rows', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/seasons?')) {
        return seasons as any;
      }
      return [...results, { ...results[0], id: 'cr3', studentName: 'Bia', status: 'pending', pointsAwarded: 0 }] as any;
    });
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    expect(within(card('Ana')).getByText('gamification.control.adjustment')).toBeInTheDocument();
    expect(within(card('Ana')).getByText('+31 gamification.pointsShort')).toBeInTheDocument();
    expect(within(card('Carlos')).getByText('gamification.first')).toBeInTheDocument();
    expect(within(card('Carlos')).getByText('gamification.results.status.approved')).toBeInTheDocument();
    expect(within(card('Carlos')).queryByRole('button', { name: 'gamification.approve' })).not.toBeInTheDocument();
    expect(within(card('Bia')).getByRole('button', { name: 'gamification.approve' })).toBeInTheDocument();
    for (const name of ['Carlos', 'Ana', 'Bia']) {
      expect(within(card(name)).getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
      expect(within(card(name)).getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
    }
  });

  it('edit sends pointsAwarded only when the owner changed it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');

    await user.click(within(card('Carlos')).getByRole('button', { name: 'common.edit' }));
    const name = await screen.findByLabelText('gamification.results.competition');
    await user.clear(name);
    await user.type(name, 'Open Lisboa');
    await user.selectOptions(screen.getByLabelText('gamification.results.position'), '2');
    expect(screen.getByText('gamification.control.pointsHelp')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(calls('PATCH', '/competition-results/cr1')).toHaveLength(1));
    expect(bodyOf('PATCH', '/competition-results/cr1')).toEqual({
      competitionName: 'Open Lisboa',
      competitionDate: '2026-03-15',
      position: 2,
      status: 'approved',
    });

    mockApi.mockClear();
    await user.click(within(card('Carlos')).getByRole('button', { name: 'common.edit' }));
    const points = await screen.findByLabelText('gamification.control.points');
    await user.clear(points);
    await user.type(points, '15');
    await user.selectOptions(screen.getByLabelText('gamification.control.status'), 'pending');
    await user.selectOptions(screen.getByLabelText('gamification.results.position'), '');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(calls('PATCH', '/competition-results/cr1')).toHaveLength(1));
    expect(bodyOf('PATCH', '/competition-results/cr1')).toMatchObject({ pointsAwarded: 15, status: 'pending', position: null });
  });

  it('marks manually set points in the edit dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Ana');
    await user.click(within(card('Ana')).getByRole('button', { name: 'common.edit' }));
    expect(await screen.findByText('gamification.control.pointsOverridden')).toBeInTheDocument();
  });

  it('delete asks for confirmation before calling DELETE', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    await user.click(within(card('Carlos')).getByRole('button', { name: 'common.delete' }));
    expect(await screen.findByText('gamification.control.deleteConfirm')).toBeInTheDocument();
    expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(0);

    await user.click(within(card('Carlos')).getByRole('button', { name: 'common.delete' }));
    await user.click(await screen.findByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(1));
  });

  it('adjusts points for a searched student, negative allowed, zero rejected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await user.click(await screen.findByRole('button', { name: 'gamification.control.adjust' }));
    const student = await screen.findByLabelText('gamification.results.student');
    await waitFor(() => expect(document.querySelectorAll('#adjust-student-options option')).toHaveLength(2));
    await user.type(student, 'Ana');
    await user.type(screen.getByLabelText('gamification.control.points'), '0');
    await user.type(screen.getByLabelText('gamification.control.reason'), 'Faltou ao evento');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('gamification.control.pointsNonZero');
    expect(calls('POST', '/competition-results/adjustments')).toHaveLength(0);

    const points = screen.getByLabelText('gamification.control.points');
    await user.clear(points);
    await user.type(points, '-5');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(calls('POST', '/competition-results/adjustments')).toHaveLength(1));
    expect(bodyOf('POST', '/competition-results/adjustments')).toEqual({ studentId: 'st2', points: -5, reason: 'Faltou ao evento' });
  });

  it('adjustment requires a reason', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await user.click(await screen.findByRole('button', { name: 'gamification.control.adjust' }));
    expect(await screen.findByLabelText('gamification.control.reason')).toBeRequired();
    expect(screen.getByLabelText('gamification.control.points')).toBeRequired();
  });
});

describe('Classificação breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeApi();
  });

  it('owner taps a student to see their entries and adjust points for them', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue(ownerSession);
    renderWithProviders(<LeaderboardPage />);
    await user.click(await screen.findByRole('button', { name: /Carlos/ }));
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&studentId=st1'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('IBJJF Open')).toBeInTheDocument();
    expect(within(dialog).getByText('gamification.control.adjustment')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'common.edit' })).toHaveLength(2);
    expect(within(dialog).getAllByRole('button', { name: 'common.delete' })).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: 'gamification.control.adjust' }));
    expect(screen.queryByLabelText('gamification.results.student')).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText('gamification.control.points'), '3');
    await user.type(screen.getByLabelText('gamification.control.reason'), 'Ajudou no evento');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(calls('POST', '/competition-results/adjustments')).toHaveLength(1));
    expect(bodyOf('POST', '/competition-results/adjustments')).toEqual({ studentId: 'st1', points: 3, reason: 'Ajudou no evento' });
  });

  it('students keep non-interactive rows', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<LeaderboardPage />);
    await screen.findByText('Carlos');
    expect(screen.queryByRole('button', { name: /Carlos/ })).not.toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalledWith(expect.stringContaining('studentId='));
  });
});
