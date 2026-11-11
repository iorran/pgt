import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/components/tabs-nav', () => ({ TabsNav: () => null }));

let seminarCreate: any = {};
vi.mock('@/components/schedule/class-create-dialog', () => ({
  ClassCreateDialog: (props: any) => {
    seminarCreate = props;
    return null;
  },
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import SeminarsPage from '@/pages/classes/seminars';

const mockApi = vi.mocked(api);
const session = (role: string) => ({ data: { user: { id: 'u1', role, academyId: 'a1', status: 'active' } }, isPending: false }) as any;

function iso(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const row = (over: object) => ({
  startTime: '10:00:00',
  endTime: '13:00:00',
  teacher: null,
  guestTeacherName: null,
  participants: 0,
  paidCount: 0,
  received: '0.00',
  pending: '0.00',
  ...over,
});

describe('Seminários tab — Owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seminarCreate = {};
    vi.mocked(useSession).mockReturnValue(session('owner'));
    mockApi.mockImplementation(async (path: string) =>
      (path === '/seminars'
        ? [
            row({ classId: 'old', name: 'Raspagens', date: iso(-30), participants: 4, paidCount: 4, received: '160.00' }),
            row({ classId: 's1', name: 'Passagem de guarda', date: iso(3), guestTeacherName: 'Ricardo Almeida', participants: 3, paidCount: 2, received: '90.00', pending: '40.00' }),
            row({ classId: 's2', name: 'Leg locks', date: iso(25) }),
          ]
        : {}) as any,
    );
  });

  it('lists upcoming seminars with their money, each linking to its page; past ones folded away', async () => {
    renderWithProviders(<SeminarsPage />);
    const upcoming = await screen.findByRole('list', { name: 'seminars.upcoming' });
    const links = within(upcoming).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/classes/seminars/s1', '/classes/seminars/s2']);
    expect(within(links[0]).getByText('seminars.receivedAmount')).toBeInTheDocument();
    expect(within(links[0]).getByText('seminars.pendingAmount')).toBeInTheDocument();
    expect(within(links[1]).getByText('seminars.noParticipantsYet')).toBeInTheDocument();
    const past = screen.getByText('seminars.past').closest('details')!;
    expect(past).not.toHaveAttribute('open');
    expect(within(past).getByRole('link', { name: /Raspagens/ })).toHaveAttribute('href', '/classes/seminars/old');
  });

  it('creates a seminar: one single-date class with its prices', async () => {
    renderWithProviders(<SeminarsPage />);
    await waitFor(() => expect(seminarCreate.seminar).toBe(true));
    await seminarCreate.onSubmit({
      name: 'Gi',
      type: 'gi',
      recurrence: 'once',
      daysOfWeek: [],
      date: '2026-11-21',
      startTime: '19:00',
      endTime: '20:00',
      teacherId: null,
      guestTeacherName: 'Ricardo Almeida',
      studentPrice: '40',
      outsiderPrice: '50',
    });
    const posts = mockApi.mock.calls.filter(([path, init]: any) => path === '/classes' && init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse((posts[0][1] as any).body)).toMatchObject({
      academyId: 'a1',
      recurrence: 'once',
      date: '2026-11-21',
      isSeminar: true,
      guestTeacherName: 'Ricardo Almeida',
      studentPrice: '40',
      outsiderPrice: '50',
    });
    expect(toast.success).toHaveBeenCalledWith('seminars.created');
  });
});

describe('Seminários tab — Student', () => {
  const seminar = (id: string, name: string, date: string) => ({
    id, name, type: 'gi', recurrence: 'once', dayOfWeek: 0, date, startTime: '10:00', endTime: '13:00',
    isSeminar: true, studentPrice: '40.00', outsiderPrice: '50.00', teacher: null, guestTeacherName: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue(session('student'));
    mockApi.mockImplementation(async (path: string) =>
      (path.startsWith('/classes')
        ? [
            seminar('far', 'Leg locks', iso(25)),
            seminar('near', 'Passagem de guarda', iso(3)),
            seminar('gone', 'Raspagens', iso(-3)),
            { id: 'c', name: 'Fundamentos', type: 'gi', recurrence: 'weekly', dayOfWeek: 2, startTime: '19:00', endTime: '20:00' },
          ]
        : path === '/seminars/mine'
          ? [{ classId: 'near', name: 'Passagem de guarda', date: iso(3), startTime: '10:00', endTime: '13:00', teacher: null, guestTeacherName: null, amount: '40.00', paidAt: null }]
          : {}) as any,
    );
  });

  it('lists every upcoming seminar by date, even a month ahead, with sign-up and cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SeminarsPage />);
    const list = await screen.findByRole('list', { name: 'seminars.upcoming' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Passagem de guarda'),
      expect.stringContaining('Leg locks'),
    ]);
    expect(screen.queryByText('Raspagens')).toBeNull();
    expect(screen.queryByText('Fundamentos')).toBeNull();
    expect(screen.getByText('seminars.sectionHint')).toBeInTheDocument();

    expect(await within(items[0]).findByText('seminars.signedUp')).toBeInTheDocument();
    await user.click(within(items[0]).getByRole('button', { name: 'seminars.cancel' }));
    expect(mockApi).toHaveBeenCalledWith('/seminars/near/signup', { method: 'DELETE' });

    await user.click(within(items[1]).getByRole('button', { name: 'seminars.join' }));
    expect(mockApi).toHaveBeenCalledWith('/seminars/far/signup', { method: 'POST' });
    // The owner-only totals are never requested for a student.
    expect(mockApi).not.toHaveBeenCalledWith('/seminars');
  });
});
