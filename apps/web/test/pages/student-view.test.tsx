import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('@/components/tabs-nav', () => ({
  TabsNav: () => null,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { StudentClassesView } from '@/pages/classes/student-view';
import { isoDate } from '@/lib/schedule';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const studentSession = {
  data: { user: { id: 'u2', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const now = new Date();

// A class active right now: dayOfWeek matches today, time window straddles now
// isActiveNow: nowMin >= sh*60+sm-15 && nowMin <= eh*60+em+60
// We set start = now-30min, end = now+30min → clearly within window
function makeActiveClass() {
  const startH = now.getHours();
  const startM = Math.max(0, now.getMinutes() - 30);
  const endH = startM >= 30 ? now.getHours() : now.getHours() + 1;
  const endM = (startM + 60) % 60;
  return {
    id: 'active1',
    name: 'Live Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
    endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
  };
}

const mockClasses = [
  {
    id: 'c1',
    name: 'Morning Gi',
    type: 'gi',
    dayOfWeek: now.getDay(),
    startTime: `${String(now.getHours()).padStart(2, '0')}:00`,
    endTime: `${String(now.getHours() + 1).padStart(2, '0')}:30`,
  },
  {
    id: 'c2',
    name: 'No-Gi Night',
    type: 'no-gi',
    dayOfWeek: (now.getDay() + 3) % 7,
    startTime: '19:00',
    endTime: '20:30',
  },
];

describe('StudentClassesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(studentSession);
  });

  it('shows the first check-in notice while the student has zero check-ins', async () => {
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? mockClasses : []) as any);
    renderWithProviders(<StudentClassesView />);
    expect(await screen.findByText('firstAccess.noticeTitle')).toBeInTheDocument();
  });

  it('hides the first check-in notice once the student has check-ins', async () => {
    mockApi.mockImplementation(
      async (path: string) => (path.startsWith('/classes') ? mockClasses : [{ id: 'ck1', checkedInAt: '2026-01-01T10:00:00Z', date: '2026-01-01', class: null }]) as any,
    );
    renderWithProviders(<StudentClassesView />);
    await screen.findByText('Morning Gi');
    await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/checkins/student/u2'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('firstAccess.noticeTitle')).not.toBeInTheDocument();
  });

  it("lists today's classes as cards, like the owner's day list", async () => {
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? mockClasses : []) as any);
    renderWithProviders(<StudentClassesView />);

    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.queryByText('No-Gi Night')).not.toBeInTheDocument();
    // The owner-only attendance feed is never requested for a student.
    expect(mockApi).not.toHaveBeenCalledWith('/checkins/academy');
  });

  it('another day shows its classes without a check-in button', async () => {
    const user = userEvent.setup();
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? [makeActiveClass(), mockClasses[1]] : []) as any);
    renderWithProviders(<StudentClassesView />);
    await screen.findByText('classes.checkinProximity');

    // The day strip is the next 7 days from today: No-Gi Night is 3 days ahead.
    const days = within(screen.getByRole('group', { name: 'classes.daysOfWeek' })).getAllByRole('button');
    await user.click(days[3]);

    expect(screen.getByText('No-Gi Night')).toBeInTheDocument();
    expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
  });

  it('shows checked-in instead of the button once the student is present', async () => {
    const activeClass = makeActiveClass();
    mockApi.mockImplementation(async (path: string) =>
      (path.startsWith('/classes')
        ? [activeClass]
        : [{ id: 'k1', checkedInAt: new Date().toISOString(), date: isoDate(new Date()), class: { id: activeClass.id } }]) as any,
    );
    renderWithProviders(<StudentClassesView />);

    expect(await screen.findByText('classes.checkedIn')).toBeInTheDocument();
    expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
  });

  it("checked in counts by the academy's day: a check-in from the academy's yesterday allows another", async () => {
    // Device noon; a check-in 59 minutes earlier, on the same device day. Pick a fixed-offset academy
    // timezone whose midnight falls between the two, so the academy is already on its next day.
    const nowAt = new Date(2026, 10, 10, 12, 0);
    const checkedInAt = new Date(nowAt.getTime() - 59 * 60_000);
    const day = (d: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
    const timezone = Array.from({ length: 27 }, (_, i) => i - 12)
      .map((h) => (h <= 0 ? `Etc/GMT+${-h}` : `Etc/GMT-${h}`))
      .find((tz) => day(nowAt, tz) !== day(checkedInAt, tz))!;
    const liveClass = { id: 'live', name: 'Noon Gi', type: 'gi', dayOfWeek: 2, startTime: '11:00', endTime: '13:00' };
    mockApi.mockImplementation(async (path: string) => {
      if (path.startsWith('/classes')) {
        return [liveClass] as any;
      }
      if (path === '/academies/mine') {
        return { id: 'a1', name: 'Academia', timezone } as any;
      }
      return (path.startsWith('/checkins/student')
        ? [{ id: 'k1', checkedInAt: checkedInAt.toISOString(), date: day(checkedInAt, timezone), class: { id: 'live' } }]
        : []) as any;
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowAt);
    try {
      renderWithProviders(<StudentClassesView />);
      await waitFor(() => expect(mockApi).toHaveBeenCalledWith('/academies/mine'));
      expect(await screen.findByText('classes.checkinProximity')).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('classes.checkedIn')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('timeline on a Tuesday evening', () => {
    // Tuesday 10 Nov 2026
    const at = (h: number, m: number) => new Date(2026, 10, 10, h, m);
    const tue = (id: string, name: string, startTime: string, endTime: string, extra: object = {}) => ({
      id, name, type: 'gi', recurrence: 'weekly', dayOfWeek: 2, date: null, startTime, endTime, ...extra,
    });

    function serve(classes: object[], checkins: object[] = [], seminars: object[] = []) {
      mockApi.mockImplementation(async (path: string) =>
        (path.startsWith('/classes') ? classes : path === '/seminars/mine' ? seminars : path.startsWith('/checkins/student') ? checkins : {}) as any,
      );
    }

    async function at_(time: Date, run: () => Promise<void>) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(time);
      try {
        await run();
      } finally {
        vi.useRealTimers();
      }
    }

    it('keeps the day in time order with the live class in place', async () => {
      await at_(at(19, 15), async () => {
        serve([tue('e', 'Evening Gi', '19:00', '20:00'), tue('m', 'Morning Gi', '07:00', '08:00')]);
        renderWithProviders(<StudentClassesView />);
        await screen.findByText('Evening Gi');
        const names = screen.getAllByRole('listitem').map((li) => li.textContent);
        expect(names[0]).toContain('Morning Gi');
        expect(names[1]).toContain('Evening Gi');
        expect(screen.getByText('classes.timeline.startedAgo')).toBeInTheDocument();
      });
    });

    it('a past class is still readable: muted text and a dashed border, no fade', async () => {
      await at_(at(19, 15), async () => {
        serve([tue('e', 'Evening Gi', '19:00', '20:00'), tue('m', 'Morning Gi', '07:00', '08:00')]);
        renderWithProviders(<StudentClassesView />);
        const past = (await screen.findByText('Morning Gi')).closest('li')!;
        expect(past.className).not.toMatch(/opacity/);
        expect(past.querySelector('.border-dashed')).not.toBeNull();
        expect(screen.getByText('Evening Gi').closest('li')!.querySelector('.border-dashed')).toBeNull();
      });
    });

    it('shows the now line between classes when nothing is on', async () => {
      await at_(at(17, 40), async () => {
        serve([tue('e', 'Evening Gi', '19:00', '20:00'), tue('m', 'Morning Gi', '07:00', '08:00')]);
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('classes.timeline.nextIn')).toBeInTheDocument();
        expect(screen.getByText('classes.timeline.opensAt')).toBeInTheDocument();
        expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
      });
    });

    it('two classes at the same time: after checking into one, the other explains why it has no button', async () => {
      await at_(at(19, 10), async () => {
        serve(
          [tue('gi', 'Adulto Gi', '19:00', '20:00'), tue('kids', 'Kids', '19:00', '20:00')],
          [{ id: 'k1', checkedInAt: at(19, 5).toISOString(), date: '2026-11-10', class: { id: 'gi' } }],
        );
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('classes.timeline.manyChoose')).toBeInTheDocument();
        expect(screen.getByText('classes.checkedIn')).toBeInTheDocument();
        expect(screen.getByText('classes.timeline.sameSlot')).toBeInTheDocument();
        expect(screen.queryByText('classes.checkinProximity')).not.toBeInTheDocument();
      });
    });

    it('back-to-back classes: the ended one keeps a check-in until an hour after it ends', async () => {
      await at_(at(20, 10), async () => {
        serve([tue('a', 'Adulto Gi', '19:00', '20:00'), tue('b', 'Avançado No-Gi', '20:00', '21:00')]);
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('classes.timeline.endedOpen')).toBeInTheDocument();
        expect(screen.getAllByText('classes.checkinProximity')).toHaveLength(2);
      });
    });

    it('a one-off class only shows on its own date', async () => {
      await at_(at(9, 0), async () => {
        serve([tue('o', 'Aulão', '19:00', '20:00', { recurrence: 'once', date: '2026-11-17' })]);
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('classes.noClassesOnDay')).toBeInTheDocument();
      });
    });

    it('a seminar offers sign-up and posts it', async () => {
      const user = userEvent.setup();
      await at_(at(9, 0), async () => {
        serve([tue('s', 'Passagem de guarda', '19:00', '21:00', { recurrence: 'once', date: '2026-11-10', isSeminar: true, studentPrice: '40.00', guestTeacherName: 'Ricardo Almeida' })]);
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('classes.teacher.guest')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'seminars.join' }));
        expect(mockApi).toHaveBeenCalledWith('/seminars/s/signup', { method: 'POST' });
      });
    });

    it('a signed-up seminar shows the pending amount and can be cancelled', async () => {
      const user = userEvent.setup();
      await at_(at(9, 0), async () => {
        serve(
          [tue('s', 'Passagem de guarda', '19:00', '21:00', { recurrence: 'once', date: '2026-11-10', isSeminar: true, studentPrice: '40.00' })],
          [],
          [{ classId: 's', name: 'Passagem de guarda', date: '2026-11-10', startTime: '19:00', endTime: '21:00', teacher: null, guestTeacherName: null, amount: '40.00', paidAt: null }],
        );
        renderWithProviders(<StudentClassesView />);
        expect(await screen.findByText('seminars.signedUp')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'seminars.cancel' }));
        expect(mockApi).toHaveBeenCalledWith('/seminars/s/signup', { method: 'DELETE' });
      });
    });
  });

  it('shows no-results message when the academy has no classes', async () => {
    mockApi.mockResolvedValue([] as any);
    renderWithProviders(<StudentClassesView />);
    expect(await screen.findByText('common.noResults')).toBeInTheDocument();
  });

  it('active class renders a check-in button on its card', async () => {
    const activeClass = makeActiveClass();
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? [activeClass] : []) as any);

    renderWithProviders(<StudentClassesView />);

    await waitFor(() => {
      expect(screen.getByText('classes.checkinProximity')).toBeInTheDocument();
    });
  });

  it('tapping check-in calls geolocation then POST /checkins', async () => {
    const user = userEvent.setup();
    const activeClass = makeActiveClass();

    mockApi.mockImplementation(async (path: string, init?: RequestInit) =>
      (init?.method === 'POST' ? {} : path.startsWith('/classes') ? [activeClass] : []) as any,
    );

    // Mock geolocation to succeed immediately
    const geo = {
      getCurrentPosition: vi.fn((success: any) =>
        success({ coords: { latitude: -23.5, longitude: -46.6 } }),
      ),
    };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: geo,
      configurable: true,
    });

    renderWithProviders(<StudentClassesView />);

    const checkinBtn = await screen.findByText('classes.checkinProximity');
    await user.click(checkinBtn);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        '/checkins',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            classId: activeClass.id,
            source: 'button',
            latitude: -23.5,
            longitude: -46.6,
          }),
        }),
      );
    });
  });

  it.each([
    [1, 'classes.locationDenied'],
    [2, 'classes.locationUnavailable'],
    [3, 'classes.locationUnavailable'],
  ])('geolocation error code %i shows %s', async (code, key) => {
    const user = userEvent.setup();
    const activeClass = makeActiveClass();
    mockApi.mockImplementation(async (path: string) => (path.startsWith('/classes') ? [activeClass] : []) as any);
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_ok: any, fail: any) =>
          fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
        ),
      },
      configurable: true,
    });

    renderWithProviders(<StudentClassesView />);
    await user.click(await screen.findByText('classes.checkinProximity'));

    expect(toast.error).toHaveBeenCalledWith(key, ...(code === 1 ? [{ description: 'classes.locationDeniedHelp' }] : []));
    expect(mockApi).not.toHaveBeenCalledWith('/checkins', expect.anything());
  });
});
