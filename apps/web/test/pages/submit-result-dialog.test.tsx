import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import { SubmitResultDialog } from '@/pages/gamification/submit-result-dialog';
import { todayYmd } from '@/lib/format';

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

const studentSession = {
  data: { user: { id: 'u2', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const ownerSession = {
  data: { user: { id: 'u1', name: 'Owner', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const students = [
  { id: 's1', name: 'Carlos' },
  { id: 's2', name: 'Ana' },
];

function postedBody() {
  const call = mockApi.mock.calls.find(([path, opts]) => path === '/competition-results' && opts?.method === 'POST');
  return call ? JSON.parse(call[1]!.body as string) : undefined;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, submitName: string) {
  await user.type(screen.getByLabelText('gamification.results.competition'), 'Open Lisboa');
  await user.type(screen.getByLabelText('gamification.results.date'), '2026-09-20');
  await user.click(screen.getByRole('radio', { name: /gamification.results.second/ }));
  await user.click(screen.getByRole('button', { name: submitName }));
}

describe('SubmitResultDialog (student)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(studentSession);
    mockApi.mockResolvedValue({} as any);
  });

  it('opens with competition, date and podium fields, no season', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitResultDialog />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.submit' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('gamification.results.competition')).toBeRequired();
    const date = screen.getByLabelText('gamification.results.date');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveAttribute('max', todayYmd());
    expect(date).toBeRequired();
    expect(screen.queryByLabelText('gamification.season')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('gamification.results.student')).not.toBeInTheDocument();
  });

  it('podium is a radiogroup with 1º/2º/3º', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitResultDialog />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.submit' }));
    const group = await screen.findByRole('radiogroup', { name: 'gamification.results.position' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    await user.click(screen.getByRole('radio', { name: /gamification.results.third/ }));
    expect(screen.getByRole('radio', { name: /gamification.results.third/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /gamification.results.first/ })).not.toBeChecked();
    // The choice must be obvious on a dark phone screen: only the chosen place shows a check mark.
    const labels = group.querySelectorAll('label');
    expect(labels[2].querySelector('[data-selected-mark]')).not.toBeNull();
    expect(labels[0].querySelector('[data-selected-mark]')).toBeNull();
    expect(labels[2]).toHaveClass('border-2');
  });

  it('posts for the logged-in student without seasonId, toasts and closes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitResultDialog />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.submit' }));
    await screen.findByRole('dialog');
    await fillAndSubmit(user, 'gamification.results.send');
    await waitFor(() => {
      expect(postedBody()).toEqual({
        studentId: 'u2',
        competitionName: 'Open Lisboa',
        competitionDate: '2026-09-20',
        position: 2,
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('gamification.results.submitted');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('explains when no season covers the date and stays open', async () => {
    const user = userEvent.setup();
    mockApi.mockRejectedValue(new Error('NO_SEASON_FOR_DATE'));
    renderWithProviders(<SubmitResultDialog />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.submit' }));
    await screen.findByRole('dialog');
    await fillAndSubmit(user, 'gamification.results.send');
    expect(await screen.findByRole('alert')).toHaveTextContent('gamification.results.noSeasonForDate');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a generic inline error for other failures', async () => {
    const user = userEvent.setup();
    mockApi.mockRejectedValue(new Error('Request failed'));
    renderWithProviders(<SubmitResultDialog />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.submit' }));
    await screen.findByRole('dialog');
    await fillAndSubmit(user, 'gamification.results.send');
    expect(await screen.findByRole('alert')).toHaveTextContent('common.genericError');
  });
});

describe('SubmitResultDialog (owner)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(ownerSession);
    mockApi.mockImplementation(async (path: string) => {
      if (path === '/students?academyId=a1') {
        return students as any;
      }
      return {} as any;
    });
  });

  it('registers a result for the chosen student', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubmitResultDialog owner />);
    await user.click(screen.getByRole('button', { name: 'gamification.results.register' }));
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.querySelectorAll('datalist option')).toHaveLength(2);
    });
    await user.type(screen.getByLabelText('gamification.results.student'), 'Ana');
    await fillAndSubmit(user, 'gamification.results.registerSubmit');
    await waitFor(() => {
      expect(postedBody()).toEqual({
        studentId: 's2',
        competitionName: 'Open Lisboa',
        competitionDate: '2026-09-20',
        position: 2,
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('gamification.results.registered');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
