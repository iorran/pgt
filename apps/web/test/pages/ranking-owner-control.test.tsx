import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, renderWithRoute } from '../render';
import ResultsPage from '@/pages/gamification/results';
import LeaderboardPage from '@/pages/gamification/leaderboard';
import StudentPointsPage from '@/pages/gamification/student-points';

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
    if (path === '/students/st1') {
      return { id: 'st1', name: 'Carlos', belt: 'black' } as any;
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

function row(text: string) {
  return screen.getByText(text).closest('li') as HTMLElement;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(within(row(text)).getByRole('button', { name: 'gamification.control.actionsFor' }));
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

  it('compact rows: position chip or Ajuste, signed points, status, truncated label; actions behind ⋯', async () => {
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/seasons?')) {
        return seasons as any;
      }
      return [
        ...results,
        { ...results[0], id: 'cr3', studentName: 'Bia', status: 'pending', pointsAwarded: 0 },
        { ...results[1], id: 'cr4', studentName: 'Rui', pointsAwarded: -3 },
      ] as any;
    });
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    expect(within(row('Ana')).getByText('gamification.control.adjustment')).toBeInTheDocument();
    expect(within(row('Ana')).getByText('+31 gamification.pointsShort')).toBeInTheDocument();
    expect(within(row('Rui')).getByText('−3 gamification.pointsShort')).toBeInTheDocument();
    const label = within(row('Ana')).getByText('Pontos acumulados');
    expect(label).toHaveAttribute('title', 'Pontos acumulados');
    expect(label).toHaveClass('truncate');
    expect(within(row('Carlos')).getByText('gamification.results.first')).toBeInTheDocument();
    expect(within(row('Carlos')).getByText('gamification.results.status.approved')).toBeInTheDocument();
    expect(within(row('Carlos')).getByText('15/03/2026')).toBeInTheDocument();
    for (const name of ['Carlos', 'Ana', 'Bia']) {
      expect(within(row(name)).queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument();
      expect(within(row(name)).queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
      expect(within(row(name)).getByRole('button', { name: 'gamification.control.actionsFor' })).toBeInTheDocument();
    }
  });

  it('pending rows keep Aprovar / Rejeitar visible', async () => {
    const user = userEvent.setup();
    mockApi.mockImplementation(async (path: string, opts?: any) => {
      if (opts?.method) {
        return {} as any;
      }
      if (path.startsWith('/seasons?')) {
        return seasons as any;
      }
      return [...results, { ...results[0], id: 'cr3', studentName: 'Bia', status: 'pending', pointsAwarded: 0 }] as any;
    });
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Bia');
    expect(within(row('Carlos')).queryByRole('button', { name: 'gamification.approve' })).not.toBeInTheDocument();
    expect(within(row('Bia')).getByRole('button', { name: 'gamification.reject' })).toBeInTheDocument();
    await user.click(within(row('Bia')).getByRole('button', { name: 'gamification.approve' }));
    await waitFor(() => expect(calls('PUT', '/competition-results/cr3/approve')).toHaveLength(1));
  });

  it('⋯ menu offers Editar and Excluir', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');
    await openMenu(user, 'Carlos');
    expect(await screen.findByRole('menuitem', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'common.delete' })).toBeInTheDocument();
  });

  it('edit sends pointsAwarded only when the owner changed it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');

    await openMenu(user, 'Carlos');
    await user.click(await screen.findByRole('menuitem', { name: 'common.edit' }));
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
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    mockApi.mockClear();
    await openMenu(user, 'Carlos');
    await user.click(await screen.findByRole('menuitem', { name: 'common.edit' }));
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
    await openMenu(user, 'Ana');
    await user.click(await screen.findByRole('menuitem', { name: 'common.edit' }));
    expect(await screen.findByText('gamification.control.pointsOverridden')).toBeInTheDocument();
  });

  it('delete confirms in place (no dialog): cancel restores the row, Escape cancels, confirm calls DELETE', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResultsPage />);
    await screen.findByText('Carlos');

    await openMenu(user, 'Carlos');
    await user.click(await screen.findByRole('menuitem', { name: 'common.delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confirm).toHaveTextContent('gamification.control.deleteInline');
    expect(row('Carlos')).toContainElement(confirm);
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'common.cancel' })).toHaveFocus());
    expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(0);

    await user.click(within(confirm).getByRole('button', { name: 'common.cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(row('Carlos')).getByText('IBJJF Open')).toBeInTheDocument();

    await openMenu(user, 'Carlos');
    await user.click(await screen.findByRole('menuitem', { name: 'common.delete' }));
    const again = await screen.findByRole('alertdialog');
    await waitFor(() => expect(within(again).getByRole('button', { name: 'common.cancel' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(0);

    await openMenu(user, 'Carlos');
    await user.click(await screen.findByRole('menuitem', { name: 'common.delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'common.delete' }));
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

describe('Classificação → student points page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeApi();
  });

  it('owner rows link to the student page for the current season', async () => {
    mockUseSession.mockReturnValue(ownerSession);
    renderWithProviders(<LeaderboardPage />);
    const link = await screen.findByRole('link', { name: /Carlos/ });
    expect(link).toHaveAttribute('href', '/gamification/students/st1?seasonId=s1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('students keep non-interactive rows', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<LeaderboardPage />);
    await screen.findByText('Carlos');
    expect(screen.queryByRole('link', { name: /Carlos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carlos/ })).not.toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalledWith(expect.stringContaining('studentId='));
  });
});

function renderStudentPage(url: string) {
  return renderWithRoute(
    <Routes>
      <Route path="/gamification" element={<p>ranking page</p>} />
      <Route path="/gamification/students/:studentId" element={<StudentPointsPage />} />
    </Routes>,
    [url],
  );
}

describe('Student points page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeApi();
    mockUseSession.mockReturnValue(ownerSession);
  });

  it('shows the header, back link and the entries of the season', async () => {
    renderStudentPage('/gamification/students/st1?seasonId=s1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Carlos' })).toBeInTheDocument();
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&studentId=st1'));
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/gamification');
    expect(await screen.findByText('IBJJF Open')).toBeInTheDocument();
    expect(screen.getByText('belts.black')).toBeInTheDocument();
    // Total = approved entries: 10 + 31.
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(within(row('IBJJF Open')).getByRole('button', { name: 'gamification.control.actionsFor' })).toBeInTheDocument();
    // Only one season: no selector.
    expect(screen.queryByLabelText('gamification.season')).not.toBeInTheDocument();
  });

  it('defaults to the first season without ?seasonId', async () => {
    renderStudentPage('/gamification/students/st1');
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s1&studentId=st1'));
  });

  it('season selector when there is more than one season', async () => {
    const user = userEvent.setup();
    const twoSeasons = [...seasons, { id: 's2', name: 'Season 2027' }];
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/seasons?')) {
        return twoSeasons as any;
      }
      if (path === '/students/st1') {
        return { id: 'st1', name: 'Carlos', belt: 'black' } as any;
      }
      return results as any;
    });
    renderStudentPage('/gamification/students/st1?seasonId=s1');
    await user.selectOptions(await screen.findByLabelText('gamification.season'), 's2');
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/competition-results?seasonId=s2&studentId=st1'));
  });

  it('redirects students to the ranking', async () => {
    mockUseSession.mockReturnValue(studentSession);
    renderStudentPage('/gamification/students/st1');
    expect(await screen.findByText('ranking page')).toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalledWith(expect.stringContaining('studentId='));
  });

  it('edit from the page opens exactly one dialog', async () => {
    const user = userEvent.setup();
    renderStudentPage('/gamification/students/st1?seasonId=s1');
    await screen.findByText('IBJJF Open');
    await openMenu(user, 'IBJJF Open');
    await user.click(await screen.findByRole('menuitem', { name: 'common.edit' }));
    await screen.findByLabelText('gamification.results.competition');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('delete confirms in place on the page', async () => {
    const user = userEvent.setup();
    renderStudentPage('/gamification/students/st1?seasonId=s1');
    await screen.findByText('IBJJF Open');
    await openMenu(user, 'IBJJF Open');
    await user.click(await screen.findByRole('menuitem', { name: 'common.delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'common.delete' }));
    await waitFor(() => expect(calls('DELETE', '/competition-results/cr1')).toHaveLength(1));
  });

  it('adjusts points with the student pre-selected (one dialog)', async () => {
    const user = userEvent.setup();
    renderStudentPage('/gamification/students/st1?seasonId=s1');
    await user.click(await screen.findByRole('button', { name: 'gamification.control.adjust' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByLabelText('gamification.results.student')).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText('gamification.control.points'), '3');
    await user.type(screen.getByLabelText('gamification.control.reason'), 'Ajudou no evento');
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(calls('POST', '/competition-results/adjustments')).toHaveLength(1));
    expect(bodyOf('POST', '/competition-results/adjustments')).toEqual({ studentId: 'st1', points: 3, reason: 'Ajudou no evento' });
  });
});
